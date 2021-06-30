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
import {Reddit, Twitter} from '../services';
import {DetailTips, TipsReceived, URL} from '../interfaces'
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
    protected redditService: Reddit
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
          schema: getModelSchemaRef(Post, {
            title: 'NewPost',
            exclude: ['id'],
          }),
        },
      },
    })
    post: Omit<Post, 'id'>,
  ): Promise<Post> {
    if (post.assets && post.assets.length > 0) {
      post.hasMedia = true
    }

    const newPost = await this.postRepository.create({
      ...post,
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
    const splitURL = post.url.split('/')
    const platform = splitURL[2].toLowerCase()
    const importer = post.importer
    const postTags = post.tags ? post.tags : []

    switch (platform) {
      case 'twitter.com':
        return this.twitterPost(splitURL[5], importer, postTags)

      case 'www.reddit.com':
        return this.redditPost(splitURL[6], importer, postTags)

      case 'www.facebook.com':
        return this.facebookPost(post.url, importer, postTags)

      default:
        throw new HttpErrors.NotFound("Cannot found the specified url!")
    }
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
    const foundPost = await this.postRepository.findOne({
      where: {
        id: id
      }
    })

    if (!foundPost) {
      throw new HttpErrors.NotFound('Post not found')
    }

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
    } else {
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
  }

  @del('/posts/{id}')
  @response(204, {
    description: 'Post DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.postRepository.deleteById(id);
  }

  async facebookPost(url: string, importer: string, postTags: string[]): Promise<Post> {
    const username = url.split('/')[3]
    const textId = url.split('/')[5]

    const foundPost = await this.postRepository.findOne({
      where: {
        textId: textId,
        platform: 'facebook',
      }
    })

    if (foundPost) {
      const foundImporter = foundPost.importBy.find(userId => userId === importer)

      if (foundImporter) {
        throw new HttpErrors.UnprocessableEntity("You have already import this post")
      }

      await this.postRepository.updateById(foundPost.id, {
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

    const newFacebookPost = {
      createdAt: new Date().toString(),
      platform: 'facebook',
      textId: textId,
      platformCreatedAt: new Date().toString(),
      link: url,
      platformUser: {
        username: username,
      },
      tags: [
        ...postTags
      ],
      importBy: [importer],
      assets: []
    }

    this.createTags(newFacebookPost.tags)


    return this.createPost(username, 'facebook', newFacebookPost)
  }

  async redditPost(textId: string, importer: string, postTags: string[]): Promise<Post> {
    const foundPost = await this.postRepository.findOne({
      where: {
        textId: textId,
        platform: 'reddit'
      }
    })

    if (foundPost) {
      const foundImporter = foundPost.importBy.find(userId => userId === importer)

      if (foundImporter) {
        throw new HttpErrors.UnprocessableEntity("You have already import this post")
      }

      await this.postRepository.updateById(foundPost.id, {
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

    const {post: redditPost, user: redditUser} = await this.reddit(textId);

    const hasMedia = redditPost.media_metadata || redditPost.is_reddit_media_domain ? true : false
    const assets: string[] = []

    if (hasMedia) {
      if (redditPost.media_metadata) {
        for (const img in redditPost.media_metadata) {
          assets.push(redditPost.media_metadata[img].s.u.replace(/amp;/g, ''))
        }
      }
      if (redditPost.is_reddit_media_domain) {
        const images = redditPost.preview.images || []
        const videos = redditPost.preview.videos || []

        for (let i = 0; i < images.length; i++) {
          assets.push(images[i].source.url.replace(/amp;/g, ''))
        }

        for (let i = 0; i < videos.length; i++) {
          assets.push(videos[i].source.url.replace(/amp;/g, ''))
        }
      }
    }

    const newRedditPost = {
      createdAt: new Date().toString(),
      platform: 'reddit',
      textId: textId,
      tags: [
        ...postTags
      ],
      hasMedia: hasMedia,
      platformCreatedAt: new Date(redditPost.created_utc * 1000).toString(),
      link: `https://reddit.com/${textId}`,
      title: redditPost.title,
      text: redditPost.selftext,
      platformUser: {
        username: redditUser.name,
        platform_account_id: 't2_' + redditUser.id,
        profile_image_url: redditUser.icon_img.split('?')[0]
      },
      importBy: [importer]
    }

    this.createTags(newRedditPost.tags)

    if (assets.length === 0) {
      return this.createPost('t2_' + redditUser.id, 'reddit', newRedditPost)
    }

    return this.createPost('t2_' + redditUser.id, 'reddit', {
      ...newRedditPost,
      assets: assets
    })
  }

  async twitterPost(textId: string, importer: string, postTags: string[]) {
    const foundPost = await this.postRepository.findOne({
      where: {
        textId: textId,
        platform: 'twitter'
      }
    })

    if (foundPost) {
      const foundImporter = foundPost.importBy.find(userId => userId === importer)

      if (foundImporter) {
        throw new HttpErrors.UnprocessableEntity("You have already import this post")
      }

      await this.postRepository.updateById(foundPost.id, {
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

    const {post: tweet, user: twitterUser} = await this.twitter(textId)
    const tags = tweet.entities ? (tweet.entities.hashtags ?
      tweet.entities.hashtags.map((hashtag: any) => hashtag.tag) : []
    ) : []

    const newTweet = {
      platformUser: {
        username: twitterUser.username,
        platform_account_id: twitterUser.id,
        profile_image_url: twitterUser.profile_image_url.replace('normal', '400x400')
      },
      platform: 'twitter',
      textId: textId,
      createdAt: new Date().toString(),
      tags: [
        ...tags,
        ...postTags
      ],
      hasMedia: tweet.attachments ? Boolean(tweet.attachments.media_keys) : false,
      link: `https://twitter.com/${twitterUser.id}/status/${textId}`,
      platformCreatedAt: tweet.created_at,
      text: tweet.text,
      importBy: [importer],
      assets: []
    }

    this.createTags(newTweet.tags)

    return this.createPost(twitterUser.id, 'twitter', newTweet)
  }

  async twitter(textId: string) {
    const {data: post, includes} = await this.twitterService.getActions(`tweets/${textId}?tweet.fields=referenced_tweets,attachments,entities,created_at,public_metrics&expansions=attachments.media_keys,author_id&user.fields=id,username,profile_image_url`)

    if (!post) throw new HttpErrors.NotFound('Cannot found the specified url!')

    return {
      post,
      user: includes.users[0]
    }

  }

  async reddit(textId: string) {
    const [data] = await this.redditService.getActions(textId + '.json')
    const redditPost = data.data.children[0].data

    const redditUser = redditPost.author
    const {data: user} = await this.redditService.getActions('user/' + redditUser + '/about.json')

    return {
      post: redditPost,
      user
    }
  }

  async createPost(platformAccountId: string, platform: string, post: any): Promise<Post> {
    let foundPeople = null;

    if (platform === 'facebook') {
      foundPeople = await this.peopleRepository.findOne({
        where: {
          username: platformAccountId,
          platform: platform
        }
      })
    } else {
      foundPeople = await this.peopleRepository.findOne({
        where: {
          platform_account_id: platformAccountId,
          platform: platform
        }
      })
    }

    if (!foundPeople) {
      const people = await this.peopleRepository.create({
        username: post.platformUser.username,
        platform: post.platform,
        platform_account_id: post.platformUser.platform_account_id,
        profile_image_url: post.platformUser.profile_image_url,
        hide: false
      })
      return this.createPostWithPublicMetric({
        ...post,
        peopleId: people.id
      }, false)
    }

    const foundCredential = await this.userCredentialRepository.findOne({
      where: {
        peopleId: foundPeople.id
      }
    })

    if (!foundCredential) {
      return this.createPostWithPublicMetric({
        ...post,
        peopleId: foundPeople.id
      }, false)
    }

    return this.createPostWithPublicMetric({
      ...post,
      peopleId: foundPeople.id,
      walletAddress: foundCredential.userId
    }, true)
  }

  async createPostWithPublicMetric(post: any, credential: boolean): Promise<Post> {
    // const createdTweet = await this.postRepository.create(post)

    if (!credential) {
      // const newKey = this.keyring().addFromUri('//' + createdTweet.id);
      const newKey = this.keyring().addFromUri('//' + post.peopleId);

      post.walletAddress = u8aToHex(newKey.publicKey);

      // this.postRepository.updateById(createdTweet.id, {
      //   walletAddress: u8aToHex(newKey.publicKey)
      // })
    }

    const createdTweet = await this.postRepository.create(post)

    this.postRepository.publicMetric(createdTweet.id).create({})

    return createdTweet
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
