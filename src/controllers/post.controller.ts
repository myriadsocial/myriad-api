import {inject} from '@loopback/core';
import {
  Filter,
  FilterExcludingWhere,
  repository
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  HttpErrors,
  param,
  patch,
  post,
  requestBody,
  response
} from '@loopback/rest';
import {Keyring} from '@polkadot/api';
import {u8aToHex} from '@polkadot/util';
import {KeypairType} from '@polkadot/util-crypto/types';
import {People, Post, PublicMetric, User} from '../models';
import {Wallet} from '../models/wallet.model';
import {
  ExperienceRepository,
  PeopleRepository,
  PostRepository,
  PublicMetricRepository,
  TagRepository,
  UserCredentialRepository
} from '../repositories';
import {Reddit, Twitter, Facebook} from '../services';
import {DetailTips, DetailUrl, TipsReceived, URL} from '../interfaces'
import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class PostController {
  constructor(
    @repository(PostRepository)
    public postRepository: PostRepository,
    @repository(UserCredentialRepository)
    public userCredentialRepository: UserCredentialRepository,
    @repository(PeopleRepository)
    public peopleRepository: PeopleRepository,
    @repository(PublicMetricRepository)
    public publicMetricRepository: PublicMetricRepository,
    @repository(ExperienceRepository)
    public experienceRepository: ExperienceRepository,
    @repository(TagRepository)
    public tagRepository: TagRepository,
    @inject('services.Twitter')
    protected twitterService: Twitter,
    @inject('services.Reddit')
    protected redditService: Reddit,
    @inject('services.Facebook')
    protected facebookService: Facebook
  ) { }

  @post('/posts')
  @response(200, {
    description: 'Post model instance',
    content: {'application/json': {schema: getModelSchemaRef(Post)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['text'],
            properties: {
              text: {
                type: 'string'
              },
              tags: {
                type: 'array',
                items: {
                  type: 'string'
                }
              },
              assets: {
                type: 'array',
                items: {
                  type: 'string'
                }
              }
            }
          },
        },
      },
    })
    post: Omit<Post, 'id'>,
  ): Promise<Post> {
    if (post.assets && post.assets.length > 0) {
      post.hasMedia = true
    }

    delete post.platformUser

    const newPost = await this.postRepository.create({
      ...post,
      platform: 'myriad',
      platformCreatedAt: new Date().toString(),
      createdAt: new Date().toString(),
      updatedAt: new Date().toString()
    });

    this.postRepository.publicMetric(newPost.id).create({})

    const tags = post.tags

    for (let i = 0; i < tags.length; i++) {
      const foundTag = await this.tagRepository.findOne({
        where: {
          or: [
            {
              id: tags[i]
            },
            {
              id: tags[i].toLowerCase(),
            },
            {
              id: tags[i].toUpperCase()
            }
          ]
        }
      })

      if (!foundTag) {
        this.tagRepository.create({
          id: tags[i],
          count: 1,
          createdAt: new Date().toString(),
          updatedAt: new Date().toString()
        })
      } else {
        const oneDay: number = 60 * 60 * 24 * 1000;
        const isOneDay: boolean = new Date().getTime() - new Date(foundTag.updatedAt).getTime() > oneDay;

        this.tagRepository.updateById(foundTag.id, {
          updatedAt: new Date().toString(),
          count: isOneDay ? 1 : foundTag.count + 1
        })
      }
    }

    return newPost
  }

  @post('/posts/import')
  @response(200, {
    description: 'Post',
    content: {'application/json': {schema: getModelSchemaRef(Post)}}
  })
  async importURL(
    @requestBody({
      description: 'Import post',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              url: {
                type: 'string'
              },
              importer: {
                type: 'string'
              },
              tags: {
                type: 'array',
                items: {
                  type: 'string'
                }
              }
            }
          }
        }
      }
    }) post: URL,
  ): Promise<Post> {
    // Format twitter https://twitter.com/{userId}/status/{tweetId}
    // Format reddit https://www.reddit.com/{subreddit_name_prefixed}/comments/{postId}/{title}/
    // Format facebook https://facebook.com/{userId}/posts/{postId}
    const splitURL = post.url.split('/')
    const checkPlatform = splitURL[2].toLowerCase().split('.');
    
    let platform: string;
    let textId: string;

    if (checkPlatform.length > 2) {
      platform = checkPlatform[1];
    } else {
      platform = checkPlatform[0]
    }

    if (platform == 'twitter' || platform == 'facebook') {
      textId = splitURL[5]
    } else {
      textId = splitURL[6]
    }

    return this.socialMediaPost({
      platform: platform,
      textId: textId,
      username: splitURL[3],
      postTags: post.tags ? post.tags : [],
      importer: post.importer
    })
  }

  async socialMediaPost(detailUrl: DetailUrl): Promise<Post> {
    const {textId, platform, postTags, importer, username} = detailUrl;
    const foundPost = await this.postRepository.findOne({
      where: {textId, platform}
    })

    let newPost;

    if (foundPost) {
      const foundImporter = foundPost.importBy.find(userId => userId === importer)

      if (foundImporter) {
        throw new HttpErrors.UnprocessableEntity("You have already import this post")
      }

      this.postRepository.updateById(foundPost.id, {
        importBy: [
          ...foundPost.importBy,
          importer
        ]
      })

      foundPost.importBy = [
        ...foundPost.importBy,
        importer
      ]
      
      return foundPost
    }

    switch (platform) {
      case 'twitter':
        const tweet = await this.twitter(textId);
        const tags = tweet.tags.filter((tag: string) => {
          return !postTags.map((postTag: string) => postTag.toLowerCase()).includes(tag.toLowerCase())
        })
        
        newPost = {
          ...tweet,
          tags: [
            ...tags,
            ...postTags
          ],
          importBy: [importer]
        }
        break;

      case 'reddit':
        const redditPost = await this.reddit(textId);        

        newPost = {
          ...redditPost,
          tags: postTags,
          importBy: [importer],
        }
        break;

      case 'facebook':
        if (!username) {
          throw new HttpErrors.UnprocessableEntity("Username not found!")
        } 

        const facebookPost = await this.facebook(username, textId);
        
        newPost = {
          ...facebookPost,
          tags: postTags,
          importBy: [importer],
          assets: []
        }

        break;

      default: 
        throw new HttpErrors.NotFound("Cannot found the specified url!")
    }

    this.createTags(newPost.tags);

    return this.createPost(newPost);
  }

  @get('/posts')
  @response(200, {
    description: 'Array of Post model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Post, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Post) filter?: Filter<Post>,
  ): Promise<Post[]> {
    return this.postRepository.find(filter);
  }

  @get('/posts/{id}')
  @response(200, {
    description: 'Post model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Post, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Post, {exclude: 'where'}) filter?: FilterExcludingWhere<Post>
  ): Promise<Post> {
    return this.postRepository.findById(id, filter);
  }

  @get('/posts/{id}/people', {
    responses: {
      '200': {
        description: 'People belonging to Post',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(People)},
          },
        },
      },
    },
  })
  async getPeople(
    @param.path.string('id') id: typeof Post.prototype.id,
  ): Promise<People> {
    return this.postRepository.people(id);
  }

  @get('/posts/{id}/public-metric', {
    responses: {
      '200': {
        description: 'Post has one PublicMetric',
        content: {
          'application/json': {
            schema: getModelSchemaRef(PublicMetric),
          },
        },
      },
    },
  })
  async get(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<PublicMetric>,
  ): Promise<PublicMetric> {
    return this.postRepository.publicMetric(id).get(filter);
  }

  @get('/posts/{id}/user', {
    responses: {
      '200': {
        description: 'User belonging to Post',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(User)},
          },
        },
      },
    },
  })
  async getUser(
    @param.path.string('id') id: typeof Post.prototype.id,
  ): Promise<User> {
    return this.postRepository.user(id);
  }

  @get('/posts/{id}/walletaddress')
  @response(200, {
    description: 'Post model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Wallet),
      },
    },
  })
  async findByIdGetWalletAddress(
    @param.path.string('id') id: string
  ): Promise<Wallet> {
    const resultPost: Post = await this.postRepository.findById(id)

    const wallet = new Wallet()
    if (resultPost != null) {
      wallet.walletAddress = resultPost.walletAddress != null
        ? resultPost.walletAddress : ''

      const resultUser = await this.userCredentialRepository.findOne({
        where: {
          peopleId: resultPost.peopleId
        }
      })

      if (resultUser != null) {
        wallet.walletAddress = resultUser.userId != null
          ? resultUser.userId : ''
      }
    }

    return wallet;
  }

  @patch('/posts/{id}')
  @response(204, {
    description: 'Post PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Post, {partial: true}),
        },
      },
    })
    post: Post,
  ): Promise<void> {
    await this.postRepository.updateById(id, {
      ...post,
      updatedAt: new Date().toString()
    });
  }

  @post('/posts/{id}/update-tips')
  @response(204, {
    description: 'Update post tips',
  })
  async updateTipsById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              tokenId: {
                type: 'string'
              },
              tipsReceived: {
                type: 'number'
              }
            }
          }
        }
      }
    }) detailTips: DetailTips,
  ): Promise<TipsReceived> {
    const foundPost = await this.postRepository.findById(id);
    const foundIndex = foundPost.tipsReceived.findIndex(tips => tips.tokenId === detailTips.tokenId)

    if (foundIndex === -1) {
      this.postRepository.updateById(foundPost.id, {
        tipsReceived: [
          ...foundPost.tipsReceived,
          {
            tokenId: detailTips.tokenId,
            totalTips: detailTips.tipsReceived
          }
        ],
        updatedAt: new Date().toString()
      })

      return {
        tokenId: detailTips.tokenId,
        totalTips: detailTips.tipsReceived
      }
    } 
    
    foundPost.tipsReceived[foundIndex] = {
      tokenId: detailTips.tokenId,
      totalTips: foundPost.tipsReceived[foundIndex].totalTips + detailTips.tipsReceived
    }

    this.postRepository.updateById(foundPost.id, {
      tipsReceived: [
        ...foundPost.tipsReceived
      ],
      updatedAt: new Date().toString()
    })

    return foundPost.tipsReceived[foundIndex]
  }

  @del('/posts/{id}')
  @response(204, {
    description: 'Post DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.postRepository.deleteById(id);
  }

  async twitter(textId: string) {
    const {
      id_str, 
      full_text, 
      created_at, 
      user, 
      entities,
      extended_entities
    } = await this.twitterService.getActions(`1.1/statuses/show.json?id=${textId}&include_entities=true&tweet_mode=extended`);

    if (!id_str) throw new HttpErrors.NotFound('Cannot found the specified url!')

    let assets: string[] = [];
    let hasMedia: boolean = true;

    const twitterTags = entities ? (entities.hashtags ?
      entities.hashtags.map((hashtag: any) => hashtag.text) : []
    ) : [];

    if (!extended_entities) hasMedia = false
    else {
      const media = extended_entities.media;

      for (let i = 0; i < media.length; i++) {
        if (media[i].type == 'photo') {
          assets.push(media[i].media_url_https);
        } else {
          const videoInfo = media[i].video_info.variants

          for (let j = 0; j < videoInfo.length; j++) {
            if (videoInfo[j].content_type === "video/mp4") {
              assets.push(videoInfo[j].url.split("?tag=12")[0]);
              break
            }
          }
        }
      }
    }

    const urls = entities.urls.map((url: any) => url.expanded_url);

    const findUrlInFullText = full_text.search("https://t.co/");
    const text = full_text.substring(0, findUrlInFullText !== -1 ? findUrlInFullText : full_text.length).trim();

    return {
      platform: 'twitter',
      createdAt: new Date().toString(),
      textId: id_str,
      text: (text + ' ' + urls.join(' ')).trim(),
      tags: twitterTags,
      platformCreatedAt: new Date(created_at).toString(),
      assets: assets,
      link: `https://twitter.com/${user.id_str}/status/${textId}`,
      hasMedia: hasMedia,
      platformUser: {
        name: user.name,
        username: user.screen_name,
        platform_account_id: user.id_str,
        profile_image_url: user.profile_image_url_https.replace('normal', '400x400')
      }
    }
  }

  async reddit(textId: string) {
    const [data] = await this.redditService.getActions(textId + '.json')
    const redditPost = data.data.children[0].data
    const assets: string[] = [];

    let url = redditPost.url_overridden_by_dest ? redditPost.url_overridden_by_dest : '';
    let hasMedia:boolean = false;

    if (redditPost.post_hint === "image") {
      assets.push(redditPost.url);
      hasMedia = true;
      url = '';
    }

    if (redditPost.is_video) {
      assets.push(redditPost.media.reddit_video.fallback_url);
      hasMedia = true;
      url = '';
    }

    if (redditPost.media_metadata) {
      for (const img in redditPost.media_metadata) {
        if (redditPost.media_metadata[img].e === "Image") {
          assets.push(redditPost.media_metadata[img].s.u.replace(/amp;/g, ''));
        }

        if (redditPost.media_metadata[img].e === "RedditVideo") {
          assets.push(`https://reddit.com/link/${textId}/video/${redditPost.media_metadata[img].id}/player`)
        }
      }

      hasMedia = true
    }

    const redditUser = redditPost.author
    const {data: user} = await this.redditService.getActions('user/' + redditUser + '/about.json')

    return {
      platform: 'reddit',
      createdAt: new Date().toString(),
      textId: textId,
      platformCreatedAt: new Date(redditPost.created_utc * 1000).toString(),
      title: redditPost.title,
      text: (redditPost.selftext + " " + url).trim(),
      link: `https://reddit.com/${textId}`,
      hasMedia,
      assets,
      platformUser: {
        name: user.subreddit.title ? user.subreddit.title : user.name,
        username: user.name,
        platform_account_id: 't2_' + user.id,
        profile_image_url: user.icon_img.split('?')[0]
      }
    }
  }
  
  async facebook(username: string, textId: string) {
    let platform_account_id: string = '';
    let profile_image_url: string = '';

    const data = await this.facebookService.getActions(username, textId);
    const findSocialMedialPostingIndex = data.search('"SocialMediaPosting"');
    const post = data.substring(findSocialMedialPostingIndex);
    
    // Get platform created at
    const findDateCreatedIndex = post.search('"dateCreated"');
    const findDateModifiedIndex = post.search('"dateModified"');
    const platformCreatedAt = post.substring(findDateCreatedIndex + '"dateCreated"'.length + 2, findDateModifiedIndex - 2)

    // Get platform account id
    const findEntityIdIndex = post.search('"entity_id"');
    const entityIndex = post.substring(findEntityIdIndex + '"entity_id"'.length + 2);

    for (let i = 0; i < entityIndex.length; i++) {
      if (entityIndex[i] == '"') break
      else {
        platform_account_id += entityIndex[i]
      }
    }

    // Get profile image url
    const findIndex = post.search(`"identifier":${platform_account_id}`);
    const getString = post.substring(findIndex);
    const findImageIndex = getString.search('"image"');
    const getImageString = getString.substring(findImageIndex + '"image"'.length + 2);

    for (let i = 0; i < getImageString.length; i++) {
      if (getImageString[i] == '"') break
      else {
        profile_image_url += getImageString[i];
      }
    }

    // Get name
    let arrayName = [];

    for (let i = findIndex - 1; i > 0; i--) {
      if (post[i] === ":") break;

      if (post[i] == '"' || post[i] == ",") continue
      else arrayName.unshift(post[i])
    } 

    // Get username
    const getUrl = post.substring(findIndex + `"identifier":${platform_account_id},"url":"`.length);

    let url = '';

    for (let i = 0; getUrl.length; i++) {
      if (getUrl[i] === '"') break
      else {
        url += getUrl[i]
      }
    }

    const userName = url.replace(/\\/g, '').split('/')[3]

    return {
      createdAt: new Date().toString(),
      platform: "facebook",
      textId: textId,
      platformCreatedAt: platformCreatedAt,
      link:  `https://facebook.com/${username}/posts/${textId}`,
      platformUser: {
        name: arrayName.join(''),
        username: userName,
        platform_account_id: platform_account_id,
        profile_image_url: profile_image_url.split('\\').join('')
      },
      assets: []
    }
  }

  async createPost(post: any): Promise<Post> {
    const {platformUser, platform} = post;

    let foundPeople = await this.peopleRepository.findOne({
      where: {
        platform_account_id: platformUser.platform_account_id,
        platform: platform
      }
    });

    if (!foundPeople) {
      const people = await this.peopleRepository.create({
        ...platformUser,
        platform,
        hide: false
      })
      return this.createPostWithPublicMetric({
        ...post,
        peopleId: people.id
      })
    }

    return this.createPostWithPublicMetric({
      ...post,
      peopleId: foundPeople.id,
    })
  }

  async createPostWithPublicMetric(post: any): Promise<Post> {
    const newKey = this.keyring().addFromUri('//' + post.peopleId);

    post.walletAddress = u8aToHex(newKey.publicKey);

    const createdPost = await this.postRepository.create(post)

    this.postRepository.publicMetric(createdPost.id).create({})

    return createdPost
  }

  async createTags(tags: string[]): Promise<void> {
    for (let i = 0; i < tags.length; i++) {
      const foundTag = await this.tagRepository.findOne({
        where: {
          or: [
            {
              id: tags[i]
            },
            {
              id: tags[i].toLowerCase(),
            },
            {
              id: tags[i].toUpperCase()
            }
          ]

        }
      })

      if (foundTag) {
        const oneDay: number = 60 * 60 * 24 * 1000;
        const isOneDay: boolean = new Date().getTime() - new Date(foundTag.updatedAt).getTime() > oneDay

        this.tagRepository.updateById(foundTag.id, {
          updatedAt: new Date().toString(),
          count: isOneDay ? 1 : foundTag.count + 1
        })
      } else {
        this.tagRepository.create({
          id: tags[i],
          createdAt: new Date().toString(),
          updatedAt: new Date().toString()
        })
      }
    }
  }

  async updateExperience(id: string, platformUser: any): Promise<void> {
    let foundPeople = null

    if (platformUser.platform === 'facebook') {
      foundPeople = await this.peopleRepository.findOne({
        where: {
          username: platformUser.username,
          platform: platformUser.platform
        }
      })
    } else {
      foundPeople = await this.peopleRepository.findOne({
        where: {
          platform_account_id: platformUser.id,
          platform: platformUser.platform
        }
      })
    }

    if (!foundPeople) {
      foundPeople = await this.peopleRepository.create({
        username: platformUser.username,
        platform: platformUser.platform,
        platform_account_id: platformUser.id,
        profile_image_url: platformUser.profile_image_url,
      })
    }

    const getExperience = await this.experienceRepository.findOne({
      where: {id}
    })

    if (getExperience) {
      const people = getExperience.people
      const platform_account_id = foundPeople.platform_account_id

      const found = people.find((person: any) => person.platform_account_id === platform_account_id)

      if (!found) {
        await this.experienceRepository.updateById(id, {
          people: [...getExperience.people, {
            username: foundPeople.username,
            platform: foundPeople.platform,
            platform_account_id: foundPeople.platform_account_id,
            profile_image_url: foundPeople.profile_image_url.replace('normal', '400x400'),
            hide: foundPeople.hide
          }]
        })
      }
    } else {
      throw new HttpErrors.NotFound('Experience Not Found')
    }
  }

  calculateRedditVote(upvote_ratio: number, score: number) {
    const upvote = Math.floor((score * upvote_ratio) / (2 * upvote_ratio - 1))
    const downvote = upvote - score

    return {
      upvote_count: upvote,
      downvote_count: downvote
    }
  }

  keyring() {
    return new Keyring({
      type: process.env.MYRIAD_CRYPTO_TYPE as KeypairType,
    });
  }
}
