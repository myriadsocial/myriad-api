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
import {PostRepository, UserCredentialRepository, PeopleRepository, PublicMetricRepository} from '../repositories';
import {Reddit, Twitter} from '../services';
import {Keyring} from '@polkadot/api'
import { KeypairType } from '@polkadot/util-crypto/types';

interface URL {
  url: string;
}

export class PostController {
  constructor(
    @repository(PostRepository)
    public postRepository: PostRepository,
    @repository(UserCredentialRepository)
    public userCredentialRepository: UserCredentialRepository,
    @repository(PeopleRepository) public peopleRepository: PeopleRepository,
    @repository(PublicMetricRepository) public publicMetricRepository: PublicMetricRepository,
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

    const keyring = new Keyring({
      type: process.env.POLKADOT_CRYPTO_TYPE as KeypairType, 
      ss58Format: Number(process.env.POLKADOT_KEYRING_PREFIX)
    });

    switch (platform) {
      case 'twitter.com':
        const twitterTextId = splitURL[5]
        const foundPost = await this.postRepository.findOne({
          where: {
            textId: twitterTextId,
            platform: 'twitter'
          }
        })

        if (foundPost) throw new HttpErrors.UnprocessableEntity('Post already exists')

        const {data: tweet, includes} = await this.twitterService.getActions(`tweets/${twitterTextId}?tweet.fields=referenced_tweets,attachments,entities,created_at&expansions=attachments.media_keys,author_id&user.fields=id,username,profile_image_url`)

        if (!tweet) throw new HttpErrors.NotFound('Cannot found the specified url!')

        const {users} = includes

        const twitterUser = users[0]

        const tags = tweet.entities ? (tweet.entities.hashtags ?
          tweet.entities.hashtags.map((hashtag: any) => hashtag.tag) : []
        ) : []

        const hasMedia = tweet.attachments ? Boolean(tweet.attachments.media_keys) : false

        const foundPeople = await this.peopleRepository.findOne({
          where: {
            platform_account_id: twitterUser.id,
            platform
          }
        })

        const newTweet = {
          platformUser: {
            username: twitterUser.username,
            platform_account_id: twitterUser.id,
            profile_image_url: twitterUser.profile_image_url.replace('normal','400x400')
          }, 
          platform: 'twitter',
          textId: twitterTextId, 
          createdAt: new Date().toString(),
          tags, hasMedia, 
          link: `https://twitter.com/${twitterUser.id}/status/${twitterTextId}`, 
          platformCreatedAt: tweet.created_at
        }

        if (!foundPeople) {
          const createdTweet = await this.postRepository.create(newTweet)
          const newKey = keyring.addFromUri('//' + createdTweet.id)

          await this.postRepository.updateById(createdTweet.id, {walletAddress: newKey.address})
          await this.publicMetricRepository.create({
            postId: createdTweet.id
          })

          const updatedTweet = await this.postRepository.findOne({
            where: {
              id: createdTweet.id
            }
          })

          if (updatedTweet) return updatedTweet
          throw new Error('Error')
        } 

        const foundCredential = await this.userCredentialRepository.findOne({
          where: {
            peopleId: foundPeople.id
          }
        })

        if (!foundCredential) {
          const createdTweet = await this.postRepository.create({
            ...newTweet,
            peopleId: foundPeople.id
          })
          const newKey = keyring.addFromUri('//' + createdTweet.id)

          await this.postRepository.updateById(createdTweet.id, {walletAddress: newKey.address})
          await this.publicMetricRepository.create({
            postId: createdTweet.id
          })

          const updatedTweet = await this.postRepository.findOne({
            where: {
              id: createdTweet.id
            }
          })

          if (updatedTweet) return updatedTweet
          throw new Error('Error')
        }

        const createdTweet = await this.postRepository.create({
          ...newTweet,
          peopleId: foundPeople.id,
          walletAddress: foundCredential.userId
        })

        await this.publicMetricRepository.create({
          postId: createdTweet.id
        })

        const updatedTweet = await this.postRepository.findOne({
          where: {
            id: createdTweet.id
          }
        })

        if (updatedTweet) return updatedTweet
        throw new Error('Error')
        
      case 'www.reddit.com':
        const redditTextId = splitURL[6]
        const foundRedditPost = await this.postRepository.findOne({
          where: {
            textId: redditTextId,
            platform: 'reddit'
          }
        })

        if (foundRedditPost) throw new HttpErrors.UnprocessableEntity("Post already exists")

        const redditUser = splitURL[4]
        const [data] = await this.redditService.getActions(redditTextId + '.json')
        const {data: user} = await this.redditService.getActions('user/' + redditUser + '/about.json') 
        const redditPost = data.data.children[0].data

        const newRedditPost = {
          createdAt: new Date().toString(),
          platform: 'reddit',
          textId: redditTextId,
          tags: [],
          hasMedia: redditPost.media_metadata || redditPost.is_reddit_media_domain ? true : false,
          platformCreatedAt: new Date(redditPost.created_utc * 1000).toString(),
          link: `https://reddit.com/${redditTextId}`,
          title: redditPost.title,
          text: redditPost.selftext,
          platformUser: {
            username: user.name,
            platform_account_id: 't2_' + user.id,
            profile_image_url: user.icon_img.split('?')[0]
          }
        }

        const foundRedditAccount = await this.peopleRepository.findOne({
          where: {
            platform_account_id: 't2_' + user.id,
            platform: 'reddit'
          }
        })

        if (!foundRedditAccount) {
          const createdPost = await this.postRepository.create(newRedditPost)
          const newKey = keyring.addFromUri('//' + createdPost.id)

          await this.postRepository.updateById(createdPost.id, {walletAddress: newKey.address})
          await this.publicMetricRepository.create({
            postId: createdPost.id
          })
          const updatedPost = await this.postRepository.findOne({
            where: {
              id: createdPost.id
            }
          })

          if (updatedPost) return updatedPost
          throw new Error('Error')
        }

        const foundRedditCredential = await this.userCredentialRepository.findOne({
          where: {
            peopleId: foundRedditAccount.id
          }
        })

        if (!foundRedditCredential) {
          const createdPost = await this.postRepository.create({
            ...newRedditPost,
            peopleId: foundRedditAccount.id
          })

          const newKey = keyring.addFromUri('//' + createdPost.id)

          await this.postRepository.updateById(createdPost.id, {walletAddress: newKey.address})
          await this.publicMetricRepository.create({
            postId: createdPost.id
          })
          const updatedPost = await this.postRepository.findOne({
            where: {
              id: createdPost.id
            }
          })

          if (updatedPost) return updatedPost
          throw new Error('Error')
        }

        const createdPost = await this.postRepository.create({
          ...newRedditPost,
          peopleId: foundRedditAccount.id,
          walletAddress: foundRedditCredential.userId
        })
        await this.publicMetricRepository.create({
          postId: createdPost.id
        })

        const updatedPost = await this.postRepository.findOne({
          where: {
            id: createdPost.id
          }
        })

        if (updatedPost) return updatedPost
        throw new Error('Error')

      default:
        throw new HttpErrors.NotFound("Cannot found the specified url!")
    }  
  }

  // @get('/posts/count')
  // @response(200, {
  //   description: 'Post model count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async count(
  //   @param.where(Post) where?: Where<Post>,
  // ): Promise<Count> {
  //   return this.postRepository.count(where);
  // }

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

      if (likeA < likeB) {
        return 1
      }

      if (likeA > likeB) {
        return -1
      }

      return 0
    })

    switch(sort) {
      case 'asc':
        posts.sort((a, b) => {
          const likeA = a.publicMetric.liked
          const likeB = b.publicMetric.liked

          if (likeA < likeB) {
            return -1
          }

          if (likeA > likeB) {
            return 1
          }

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

      if (commentA < commentB) {
        return 1
      }

      if (commentA > commentB) {
        return -1
      }

      return 0
    })

    switch(sort) {
      case 'asc':
        posts.sort((a, b) => {
          const commentA = a.publicMetric.comment
          const commentB = b.publicMetric.comment

          if (commentA < commentB) {
            return -1
          }

          if (commentA > commentB) {
            return 1
          }

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

      if (dateA < dateB) {
        return 1
      }

      if (dateA > dateB) {
        return -1
      }

      return 0
    })

    switch(sort) {
      case "asc":
        posts.sort((a, b) => {
          const dateA = a.platformCreatedAt
          const dateB = b.platformCreatedAt

          if (dateA < dateB) {
            return -1
          }

          if (dateA > dateB) {
            return 1
          }

          return 0
        })

        return posts

      case "desc":
        return posts

      default:
        return posts
    }
  }

  // @patch('/posts')
  // @response(200, {
  //   description: 'Post PATCH success count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async updateAll(
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(Post, {partial: true}),
  //       },
  //     },
  //   })
  //   post: Post,
  //   @param.where(Post) where?: Where<Post>,
  // ): Promise<Count> {
  //   return this.postRepository.updateAll(post, where);
  // }

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

  // @put('/posts/{id}')
  // @response(204, {
  //   description: 'Post PUT success',
  // })
  // async replaceById(
  //   @param.path.string('id') id: string,
  //   @requestBody() post: Post,
  // ): Promise<void> {
  //   await this.postRepository.replaceById(id, post);
  // }

  @del('/posts/{id}')
  @response(204, {
    description: 'Post DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.postRepository.deleteById(id);
  }
}
