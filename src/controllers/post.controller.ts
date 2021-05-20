import {
  Filter,
  FilterExcludingWhere,
  repository
} from '@loopback/repository';
import {
  del, get,
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
  response,
  HttpErrors
} from '@loopback/rest';
import {inject} from '@loopback/core';
import {Post} from '../models';
import {Wallet} from '../models/wallet.model';
import {
  PostRepository, 
  UserCredentialRepository, 
  PeopleRepository, 
  PublicMetricRepository,
  ExperienceRepository,
  TagRepository
} from '../repositories';
import {Reddit, Twitter} from '../services';
import {Keyring} from '@polkadot/api'
import { KeypairType } from '@polkadot/util-crypto/types';

interface URL {
  url: string;
  importer: string;
}

export class PostController {
  constructor(
    @repository(PostRepository)
    public postRepository: PostRepository,
    @repository(UserCredentialRepository)
    public userCredentialRepository: UserCredentialRepository,
    @repository(PeopleRepository) public peopleRepository: PeopleRepository,
    @repository(PublicMetricRepository) public publicMetricRepository: PublicMetricRepository,
    @repository(ExperienceRepository) public experienceRepository: ExperienceRepository,
    @repository(TagRepository) public tagRepository: TagRepository,
    @inject('services.Twitter') protected twitterService: Twitter,
    @inject('services.Reddit') protected redditService: Reddit
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
    return this.postRepository.create({
      ...post,
      platformCreatedAt: new Date().toString(),
      createdAt: new Date().toString(),
      updatedAt: new Date().toString()
    });
  }

  @post('/posts/import')
  @response(200, {
    description: 'Import post'
  })
  async importURL(
    @requestBody() post: URL,
  ): Promise<Post> {
    const splitURL = post.url.split('/')
    const platform = splitURL[2].toLowerCase()
    const importer = post.importer

    switch (platform) {
      case 'twitter.com':
        return this.twitterPost(splitURL[5], importer)
        
      case 'www.reddit.com':
        return this.redditPost(splitURL[6], importer)

      case 'www.facebook.com':
        return this.facebookPost(post.url, importer)

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
    @requestBody() post:{tips: number},
  ): Promise<number> {
    let totalTips = 0

    const foundPost = await this.postRepository.findOne({
      where: {
        id: id
      }
    })

    if (foundPost) {
      totalTips = foundPost.tipsReceived + post.tips
    }

    await this.postRepository.updateById(id, {
      ...post,
      tipsReceived: totalTips,
      updatedAt: new Date().toString()
    });

    return totalTips
  }

  @del('/posts/{id}')
  @response(204, {
    description: 'Post DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.postRepository.deleteById(id);
  }

  async facebookPost (url: string, importer:string):Promise<Post> {
    const username = url.split('/')[3]
    const textId = url.split('/')[5]

    const foundPost = await this.postRepository.findOne({
      where: {
        textId: textId,
        platform: 'facebook',
      }
    })

    if (foundPost) {
      // await this.updateExperience(experienceId, {
      //   username: foundPost.platformUser?.username,
      //   platform: foundPost.platform
      // })

      const foundImporter = foundPost.importBy.find(userId => userId === importer)

      if (!foundImporter) {
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
      
      } 

      return foundPost
    }

    // await this.updateExperience(experienceId, {
    //   username: username,
    //   platform: 'facebook'
    // })

    const newFacebookPost = {
      createdAt: new Date().toString(),
      platform: 'facebook',
      textId: textId,
      platformCreatedAt: new Date().toString(),
      link: url,
      platformUser: {
        username: username,
      },
      importBy: [importer]
    }

    return this.createPost(username, 'facebook', newFacebookPost)
  }

  async redditPost (textId:string, importer:string):Promise<Post> {
    const foundPost = await this.postRepository.findOne({
      where: {
        textId: textId,
        platform: 'reddit'
      }
    })

    if (foundPost) {
      // await this.updateExperience(experienceId, {
      //   id: foundPost.platformUser?.platform_account_id,
      //   username: foundPost.platformUser?.username,
      //   platform: foundPost.platform,
      //   profile_image_url: foundPost.platformUser?.profile_image_url
      // })

      const foundImporter = foundPost.importBy.find(userId => userId === importer)

      if (!foundImporter) {
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
      } 

      return foundPost
    }

    const {post: redditPost, user: redditUser} = await this.reddit(textId); 

    // await this.updateExperience(experienceId, {
    //   username: redditUser.name,
    //   id: 't2_' + redditUser.id,
    //   platform: 'reddit',
    //   profile_image_url: redditUser.icon_img.split('?')[0]
    // })

    let updatedReddit = null
    const newRedditPost = {
      createdAt: new Date().toString(),
      platform: 'reddit',
      textId: textId,
      tags: [],
      hasMedia: redditPost.media_metadata || redditPost.is_reddit_media_domain ? true : false,
      platformCreatedAt: new Date(redditPost.created_utc * 1000).toString(),
      link: `https://reddit.com/${textId}`,
      title: redditPost.title,
      text: redditPost.selftext,
      platformUser: {
        username: redditUser.name,
        platform_account_id: 't2_' + redditUser.id,
        profile_image_url: redditUser.icon_img.split('?')[0]
      },
      platformPublicMetric: this.calculateRedditVote(redditPost.upvote_ratio, redditPost.score),
      importBy: [importer]
    }

    if (newRedditPost.hasMedia) {
      const assets:string[] = []

      if (redditPost.media_metadata) {
        for (const img in redditPost.media_metadata) {
          assets.push(redditPost.media_metadata[img].s.u.replace(/amp;/g, ''))
        }
      }
      if (redditPost.is_reddit_media_domain) {
        const images = redditPost.preview.images || []
        const videos = redditPost.preview.videos || []

        for (let i = 0; i < images.length; i++) {
          assets.push(images[i].source.url.replace(/amp;/g,''))
        }

        for (let i = 0; i < videos.length; i++) {
          assets.push(videos[i].source.url.replace(/amp;/g,''))
        }
      }
      updatedReddit = {
        ...newRedditPost,
        assets: assets
      }
    } else {
      updatedReddit = {
        ...newRedditPost
      }
    }

    return this.createPost('t2_' + redditUser.id, 'reddit', updatedReddit)
  }

  async twitterPost (textId: string, importer: string) {
    const foundPost = await this.postRepository.findOne({
      where: {
        textId: textId,
        platform: 'twitter'
      }
    })

    if (foundPost) {
      // await this.updateExperience(experienceId, {
      //   id: foundPost.platformUser?.platform_account_id,
      //   username: foundPost.platformUser?.username,
      //   platform: foundPost.platform,
      //   profile_image_url: foundPost.platformUser?.profile_image_url
      // }) 
      const foundImporter = foundPost.importBy.find(userId => userId === importer)

      if (!foundImporter) {
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
      } 

      return foundPost
    }

    const {post: tweet, user: twitterUser} = await this.twitter(textId)

    // await this.updateExperience(experienceId, {
    //   ...twitterUser,
    //   platform: 'twitter'
    // })

    const platformPublicMetric = {
      retweet_count: tweet.public_metrics.retweet_count,
      like_count: tweet.public_metrics.like_count,
    }

    const tags = tweet.entities ? (tweet.entities.hashtags ?
      tweet.entities.hashtags.map((hashtag: any) => hashtag.tag) : []
    ) : []

    const newTweet = {
      platformUser: {
        username: twitterUser.username,
        platform_account_id: twitterUser.id,
        profile_image_url: twitterUser.profile_image_url.replace('normal','400x400')
      }, 
      platformPublicMetric: platformPublicMetric,
      platform: 'twitter',
      textId: textId, 
      createdAt: new Date().toString(),
      tags, 
      hasMedia: tweet.attachments ? Boolean(tweet.attachments.media_keys) : false, 
      link: `https://twitter.com/${twitterUser.id}/status/${textId}`, 
      platformCreatedAt: tweet.created_at,
      text: tweet.text,
      importBy: [importer]
    }

    await this.createTags(newTweet.tags)

    return this.createPost(twitterUser.id, 'twitter', newTweet)
  }

  async twitter (textId: string) {
    const {data: post, includes} = await this.twitterService.getActions(`tweets/${textId}?tweet.fields=referenced_tweets,attachments,entities,created_at,public_metrics&expansions=attachments.media_keys,author_id&user.fields=id,username,profile_image_url`)

    if (!post) throw new HttpErrors.NotFound('Cannot found the specified url!')

    return {
      post,
      user: includes.users[0]
    }
    
  }

  async reddit (textId: string) {    
    const [data] = await this.redditService.getActions(textId + '.json')
    const redditPost = data.data.children[0].data

    const redditUser = redditPost.author
    const {data: user} = await this.redditService.getActions('user/' + redditUser + '/about.json')
    
    return {
      post: redditPost,
      user
    }
  }

  async createPost(platformAccountId: string, platform: string, post: object):Promise<Post> {
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
      return this.createPostWithPublicMetric(post, false)
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

  async createPostWithPublicMetric (post:any, credential: boolean):Promise<Post> {
    const assets = [
      ...post.assets
    ]

    delete post.assets

    const createdTweet = await this.postRepository.create(post)

    if (post.platform === 'reddit' && assets.length > 0) {
      await this.postRepository.asset(createdTweet.id).create({
        media_urls: assets
      })
    }
    
    await this.postRepository.publicMetric(createdTweet.id).create({})

    if (!credential) {
      const newKey = this.keyring().addFromUri('//' + createdTweet.id)

      await this.postRepository.updateById(createdTweet.id, {walletAddress: newKey.address})
    }

    return createdTweet
  }

  async createTags(tags: string[]) :Promise<void> {
    const fetchTags = await this.tagRepository.find()
    const filterTags = tags.filter((tag:string) => {
      const foundTag = fetchTags.find((fetchTag:any) => fetchTag.id.toLowerCase() === tag.toLowerCase())

      if (foundTag) return false
      return true
    })

    if (filterTags.length === 0) return

    await this.tagRepository.createAll(filterTags.map((filterTag:string) => {
      return {
        id: filterTag,
        hide: false
      }
    }))
  }

  async updateExperience(id: string, platformUser:any): Promise<void> {
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
      where: { id }
    })

    if (getExperience) {
      const people = getExperience.people
      const platform_account_id = foundPeople.platform_account_id

      const found = people.find((person:any) => person.platform_account_id === platform_account_id)

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

  calculateRedditVote(upvote_ratio:number, score:number) {
    const upvote = Math.floor((score * upvote_ratio) / (2 * upvote_ratio - 1))
    const downvote = upvote - score

    return {
      upvote_count: upvote,
      downvote_count: downvote
    }
  }

  keyring() {
    return new Keyring({
      type: process.env.POLKADOT_CRYPTO_TYPE as KeypairType, 
      ss58Format: Number(process.env.POLKADOT_KEYRING_PREFIX)
    });
  }
}
