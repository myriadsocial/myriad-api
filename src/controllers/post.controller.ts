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
  ExperienceRepository
} from '../repositories';
import {Reddit, Twitter} from '../services';
import {Keyring} from '@polkadot/api'
import { KeypairType } from '@polkadot/util-crypto/types';

interface URL {
  url: string;
  experienceId: string;
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
    const experienceId = post.experienceId

    switch (platform) {
      case 'twitter.com':
        return this.twitterPost(splitURL[5], experienceId)
        
      case 'www.reddit.com':
        return this.redditPost(splitURL[6], experienceId)

      case 'www.facebook.com':
        return this.facebookPost(post)

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

  @get('/posts/liked')
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
  async findMostLiked(
    @param.query.string("sort") sort: string
  ): Promise<Post[]> {
    const posts = await this.postRepository.find({include: ["publicMetric"]});

    posts.sort((a, b) => {
      const likeA = a.publicMetric.liked
      const likeB = b.publicMetric.liked

      if (likeA < likeB) return 1
      if (likeA > likeB) return -1
      return 0
    })

    switch(sort) {
      case 'asc':
        posts.sort((a, b) => {
          const likeA = a.publicMetric.liked
          const likeB = b.publicMetric.liked

          if (likeA < likeB) return -1
          if (likeA > likeB) return 1
          return 0
        })

        return posts

      case 'desc':
        return posts

      default:
        return posts
    }
  }

  @get('/posts/comments')
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
  async findMostComments(
    @param.query.string("sort") sort: string
  ): Promise<Post[]> {
    const posts = await this.postRepository.find({include: ["publicMetric"]});

    posts.sort((a, b) => {
      const commentA = a.publicMetric.comment
      const commentB = b.publicMetric.comment

      if (commentA < commentB) return 1
      if (commentA > commentB) return -1
      return 0
    })

    switch(sort) {
      case 'asc':
        posts.sort((a, b) => {
          const commentA = a.publicMetric.comment
          const commentB = b.publicMetric.comment

          if (commentA < commentB) return -1
          if (commentA > commentB) return 1
          return 0
        })

        return posts

      case 'desc':
        return posts

      default:
        return posts
    }
  }

  @get('/posts/dates')
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
  async findNewestDate(
    @param.query.string("sort") sort: string
  ): Promise<Post[]> {
    const posts = await this.postRepository.find();

    posts.sort((a,b) => {
      const dateA = a.platformCreatedAt
      const dateB = b.platformCreatedAt

      if (dateA < dateB) return 1
      if (dateA > dateB) return -1
      return 0
    })

    switch(sort) {
      case "asc":
        posts.sort((a, b) => {
          const dateA = a.platformCreatedAt
          const dateB = b.platformCreatedAt

          if (dateA < dateB) return -1
          if (dateA > dateB) return 1
          return 0
        })

        return posts

      case "desc":
        return posts

      default:
        return posts
    }
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

  @del('/posts/{id}')
  @response(204, {
    description: 'Post DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.postRepository.deleteById(id);
  }

  async facebookPost (post:URL):Promise<Post> {
    const {url, experienceId} = post
    const username = url.split('/')[3]

    const foundPost = await this.postRepository.findOne({
      where: {
        textId: url.split('/')[5],
        platform: 'facebook',
      }
    })

    if (foundPost) {throw new HttpErrors.UnprocessableEntity('Post Post already been imported')}

    let foundPeople = await this.peopleRepository.findOne({
      where: {
        username: username,
        platform: 'facebook'
      }
    })
    
    if (!foundPeople) {
      foundPeople = await this.peopleRepository.create({
        username: username,
        platform: 'facebook'
      })
    }

    const getExperience = await this.experienceRepository.findOne({
      where: {
        id: experienceId
      }
    })

    if (getExperience) {
      const people = getExperience.people
      const username = foundPeople.username

      const found = people.find((person:any) => person.username === username)

      if (!found) {
        await this.experienceRepository.updateById(experienceId, {
          people: [...getExperience.people, {
            username: foundPeople.username,
            platform: foundPeople.platform,
            hide: foundPeople.hide
          }]
        })
      }
    } else {
      throw new HttpErrors.NotFound('Experience Not Found')
    }

    const newFacebookPost = {
      createdAt: new Date().toString(),
      platform: 'facebook',
      textId: url.split('/')[5],
      platformCreatedAt: new Date().toString(),
      link: url,
      platformUser: {
        username: username,
      }
    }

    return this.createPost(username, 'facebook', newFacebookPost)
  }

  async redditPost (textId:string, experienceId:string):Promise<Post> {
    const {post: redditPost, user: redditUser} = await this.reddit(textId); 

    let foundPeople = await this.peopleRepository.findOne({
      where: {
        platform_account_id: 't2_' + redditUser.id,
        platform: 'reddit'
      }
    })  

    if (!foundPeople) {
      foundPeople = await this.peopleRepository.create({
        username: redditUser.name,
        platform_account_id: 't2_' + redditUser.id,
        platform: 'reddit',
        profile_image_url: redditUser.icon_img.split('?')[0]
      })
    }

    const getExperience = await this.experienceRepository.findOne({
      where: {
        id: experienceId
      }
    })

    if (getExperience) {
      const people = getExperience.people
      const platform_account_id = foundPeople.platform_account_id

      const found = people.find((person:any) => person.platform_account_id === platform_account_id)

      if (!found) {
        await this.experienceRepository.updateById(experienceId, {
          people: [...getExperience.people, {
            username: foundPeople.username,
            platform: foundPeople.platform,
            platform_account_id: foundPeople.platform_account_id,
            profile_image_url: foundPeople.profile_image_url,
            hide: foundPeople.hide
          }]
        })
      }
    } else {
      throw new HttpErrors.NotFound('Experience Not Found')
    }

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
      }
    }

    return this.createPost('t2_' + redditUser.id, 'reddit', newRedditPost)
  }

  async twitterPost (textId: string, experienceId: string) {
    const {post: tweet, user: twitterUser} = await this.twitter(textId)

    let foundPeople = await this.peopleRepository.findOne({
      where: {
        platform_account_id: twitterUser.id,
        platform: 'twitter'
      }
    })

    if (!foundPeople) {
      foundPeople = await this.peopleRepository.create({
        username: twitterUser.username,
        platform: 'twitter',
        platform_account_id: twitterUser.id,
        profile_image_url: twitterUser.profile_image_url,
      })
    }

    const getExperience = await this.experienceRepository.findOne({
      where: {
        id: experienceId
      }
    })

    if (getExperience) {
      const people = getExperience.people
      const platform_account_id = foundPeople.platform_account_id

      const found = people.find((person:any) => person.platform_account_id === platform_account_id)

      if (!found) {
        await this.experienceRepository.updateById(experienceId, {
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

    const tags = tweet.entities ? (tweet.entities.hashtags ?
      tweet.entities.hashtags.map((hashtag: any) => hashtag.tag) : []
    ) : []

    const newTweet = {
      platformUser: {
        username: twitterUser.username,
        platform_account_id: twitterUser.id,
        profile_image_url: twitterUser.profile_image_url.replace('normal','400x400')
      }, 
      platform: 'twitter',
      textId: textId, 
      createdAt: new Date().toString(),
      tags, 
      hasMedia: tweet.attachments ? Boolean(tweet.attachments.media_keys) : false, 
      link: `https://twitter.com/${twitterUser.id}/status/${textId}`, 
      platformCreatedAt: tweet.created_at,
      text: tweet.text
    }

    return this.createPost(twitterUser.id, 'twitter', newTweet)
  }

  async twitter (textId: string) {
    const foundPost = await this.postRepository.findOne({
      where: {
        textId
      }
    })

    if (foundPost) throw new HttpErrors.UnprocessableEntity("Post already been imported")

    const {data: post, includes} = await this.twitterService.getActions(`tweets/${textId}?tweet.fields=referenced_tweets,attachments,entities,created_at&expansions=attachments.media_keys,author_id&user.fields=id,username,profile_image_url`)

    if (!post) throw new HttpErrors.NotFound('Cannot found the specified url!')

    return {
      post,
      user: includes.users[0]
    }
  }

  async reddit (textId: string) {
    const foundPost = await this.postRepository.findOne({
      where: {
        textId
      }
    })

    if (foundPost) throw new HttpErrors.UnprocessableEntity("Post already been imported")
    
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
    if (platform === 'facebook') {
      const foundPeople = await this.peopleRepository.findOne({
        where: {
          username: platformAccountId,
          platform: platform
        }
      })

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

    const foundPeople = await this.peopleRepository.findOne({
      where: {
        platform_account_id: platformAccountId,
        platform: platform
      }
    })

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

  async createPostWithPublicMetric (post:object, credential: boolean):Promise<Post> {
    const createdTweet = await this.postRepository.create(post)
    const publicMetric = await this.postRepository.publicMetric(createdTweet.id).create({})

    if (!credential) {
      const newKey = this.keyring().addFromUri('//' + createdTweet.id)

      await this.postRepository.updateById(createdTweet.id, {walletAddress: newKey.address})

      createdTweet.walletAddress = newKey.address
      createdTweet.publicMetric = publicMetric
    } else {
      createdTweet.publicMetric = publicMetric
    }

    return createdTweet
  }

  keyring() {
    return new Keyring({
      type: process.env.POLKADOT_CRYPTO_TYPE as KeypairType, 
      ss58Format: Number(process.env.POLKADOT_KEYRING_PREFIX)
    });
  }
}
