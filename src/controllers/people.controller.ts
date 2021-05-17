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
  param,
  patch,
  post,
  put,
  requestBody,
  response,
  HttpErrors
} from '@loopback/rest';
import {Keyring} from '@polkadot/api';
import { KeypairType } from '@polkadot/util-crypto/types';
import dotenv from 'dotenv';
import {xml2json} from 'xml-js';
import {People, Post} from '../models';
import {
  PeopleRepository, 
  PostRepository, 
  TagRepository, 
  UserCredentialRepository, 
  UserRepository,
  PublicMetricRepository
} from '../repositories';
import {Reddit, Rsshub, Twitter, Facebook} from '../services';
dotenv.config()

export class PeopleController {
  constructor(
    @repository(PeopleRepository)
    public peopleRepository: PeopleRepository,
    @repository(PostRepository)
    public postRepository: PostRepository,
    @repository(TagRepository)
    public tagRepository: TagRepository,
    @repository(UserCredentialRepository)
    public userCredentialRepository: UserCredentialRepository,
    @repository(UserRepository)
    public userRepository: UserRepository,
    @repository(PublicMetricRepository)
    public publicMetricRepository: PublicMetricRepository,
    @inject('services.Twitter') protected twitterService: Twitter,
    @inject('services.Reddit') protected redditService: Reddit,
    @inject('services.Rsshub') protected rsshubService: Rsshub,
    @inject('services.Facebook') protected facebookService: Facebook
  ) { }

  @post('/people')
  @response(200, {
    description: 'People model instance',
    content: {'application/json': {schema: getModelSchemaRef(People)}}
  })

  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(People, {
            title: 'NewPeople',
          })
        }
      }
    })
    people: People
  ): Promise<People> {
    let foundPeople = await this.peopleRepository.findOne({
      where: {
        or: [
          {platform_account_id: people.platform_account_id, platform: people.platform},
          {username: people.username, platform: people.platform}
        ]
      }
    })

    if (!foundPeople) foundPeople = await this.peopleRepository.create(people)

    const isFound = await this.createPostByPeople(foundPeople)

    if (!isFound) {
      await this.peopleRepository.deleteById(foundPeople.id)

      throw new HttpErrors.NotFound(`${people.username} is not found in ${people.platform} social media`)
    }

    return foundPeople
  }

  @get('/people')
  @response(200, {
    description: 'Array of People model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(People, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(People) filter?: Filter<People>,
  ): Promise<People[]> {
    return this.peopleRepository.find(filter);
  }

  // @get('/people/count')
  // @response(200, {
  //   description: 'People model count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async count(
  //   @param.where(People) where?: Where<People>,
  // ): Promise<Count> {
  //   return this.peopleRepository.count(where);
  // }

  // @patch('/people')
  // @response(200, {
  //   description: 'People PATCH success count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async updateAll(
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(People, {partial: true}),
  //       },
  //     },
  //   })
  //   people: People,
  //   @param.where(People) where?: Where<People>,
  // ): Promise<Count> {
  //   return this.peopleRepository.updateAll(people, where);
  // }

  @get('/people/{id}')
  @response(200, {
    description: 'People model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(People, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(People, {exclude: 'where'}) filter?: FilterExcludingWhere<People>
  ): Promise<People> {
    return this.peopleRepository.findById(id, filter);
  }

  @patch('/people/{id}')
  @response(204, {
    description: 'People PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(People, {partial: true}),
        },
      },
    })
    people: People,
  ): Promise<void> {
    await this.peopleRepository.updateById(id, people);
  }

  @put('/people/{id}')
  @response(204, {
    description: 'People PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() people: People,
  ): Promise<void> {
    await this.peopleRepository.replaceById(id, people);
  }

  @del('/people/{id}')
  @response(204, {
    description: 'People DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.peopleRepository.deleteById(id);
  }

  async createPostByPeople(people:People):Promise<boolean> {
    try {
      const posts = await this.socialMediaPost(people)
      
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i]
        const foundPost = await this.postRepository.findOne({
          where: {
            textId: people.platform === 'facebook' ? this.getFBTextId(post) : post.id
          }
        })

        if (foundPost) continue

        const platformPost = await this.newPost(post, people)

        let newPost = null

        if (people.platform === "facebook") {
          const textId = this.getFBTextId(post)

          newPost = {
            ...platformPost,
            textId,
            link: `https://facebook.com/${people.platform_account_id}/posts/${textId}`
          }
        } else {
          newPost = {
            ...platformPost
          }
        }

        const userCredential = await this.userCredentialRepository.findOne({
          where: {
            peopleId: people.id
          }
        })

        if (userCredential) {
          await this.createPostPublicMetric({
            ...newPost,
            walletAddress: userCredential.userId
          }, true)
        }

        await this.createPostPublicMetric(newPost, false)
      }

      return true
    } catch (err) {
      return false 
    }
  }

  async socialMediaPost(people:People) {
    switch(people.platform) {
      case "twitter":
        const platform_account_id = people.platform_account_id
        const maxResults = 5
        const tweetField = "attachments,entities,referenced_tweets,created_at"

        const {data: tweets} = await this.twitterService.getActions(`users/${platform_account_id}/tweets?max_results=${maxResults}&tweet.fields=${tweetField}`)
        
        if (!tweets) throw new Error("People does not exists") 

        const filterTweets = tweets.filter((post: any) => !post.referenced_tweets)

        return filterTweets

      case "reddit":
        const {data: user} = await this.redditService.getActions(`u/${people.username}.json?limit=5`)
        const redditPost = await this.postRepository.find({where: {platform: 'reddit'}})
        const filterPost = user.children.filter((post: any) => {
          return !redditPost.find(e => post.data.id === e.textId) && post.kind === 't3'
        })

        return filterPost.map((post:any) => post.data)

      case "facebook":
        const xml = await this.rsshubService.getContents(people.platform_account_id)
        const resultJSON = await xml2json(xml, {compact: true, trim: true})
        const response = JSON.parse(resultJSON)

        return response.rss.channel.item

      default:
        throw new Error("Platform does not exists")
    }
  }

  async createPostPublicMetric(post:object, credential:boolean):Promise<void> {
    const newPost = await this.postRepository.create(post)

    await this.publicMetricRepository.create({
      liked: 0,
      disliked: 0,
      comment: 0,
      postId: newPost.id
    })

    if (!credential) {
      const keyring = new Keyring({
        type: process.env.POLKADOT_CRYPTO_TYPE as KeypairType, 
        ss58Format: Number(process.env.POLKADOT_KEYRING_PREFIX)
      });
      const newKey = keyring.addFromUri('//' + newPost.id)
      
      await this.postRepository.updateById(newPost.id, {walletAddress: newKey.address});
    }
  }

  async newPost(post:any, people:any) {    
    const newPost = {
      platformUser: {
        username: people.username,
        platform_account_id: people.platform_account_id,
        profile_image_url: people.profile_image_url
      },
      platform: people.platform,
      textId: post.id,
      peopleId: people.id,
      createdAt: new Date().toString()
    }

    switch (people.platform) {
      case "twitter":
        const tags = post.entities ? (post.entities.hashtags ? 
          post.entities.hashtags.map((hashtag: any) => hashtag.tag) : []
        ) : []

        await this.createTags(tags)

        return {
          ...newPost,
          text: post.text,
          tags: tags, 
          hasMedia: post.attachments ? Boolean(post.attachments.media_keys) : false, 
          link: `https://twitter.com/${people.platform_account_id}/status/${post.id}`, 
          platformCreatedAt: post.created_at
        }

      case "reddit":
        return {
          ...newPost,
          tags: [], 
          hasMedia: post.media_metadata || post.is_reddit_media_domain ? true : false, 
          link: `https://reddit.com/${post.id}`, 
          platformCreatedAt: new Date(post.created_utc * 1000).toString(),
          title: post.title,
          text: post.selftext
        }
      
      case "facebook":
        return {
          ...newPost,
          hasMedia: false,
          tags: [],
          platformCreatedAt: new Date().toString()
        }

      default:
        throw new Error("Platform doesn't exists")
    }
  }

  getFBTextId (post:any) {
    const link = post.link._text.split("=")
    return link[1].substr(0, link[1].length - 3)
  }

  async createTags(tags:string[]):Promise<void> {
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
}
