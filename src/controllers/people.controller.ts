import {inject} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  response,
} from '@loopback/rest';
import dotenv from 'dotenv';
import fs from 'fs';
import snoowrap from 'snoowrap';
import {People} from '../models';
import {PeopleRepository, PostRepository, TagRepository, UserCredentialRepository, UserRepository} from '../repositories';
import {Reddit, Twitter} from '../services';
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
    public userRepository: UserRepository,//
    @inject('services.Twitter') protected twitterService: Twitter,
    @inject('services.Reddit') protected redditService: Reddit
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
    const findPeople = await this.peopleRepository.findOne({where: {username: people.username, platform: people.platform}})

    if (!findPeople) {
      return this.peopleRepository.create(people)
    }

    return findPeople
  }

  @post('/people-posts')
  @response(200, {
    description: 'People model instance from twitter platform',
    content: {'application/json': {schema: getModelSchemaRef(People)}},
  })
  async createPeopleFromPlatform(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(People, {
            title: 'NewPeople',

          }),
        },
      },
    })
    people: People,
  ): Promise<any> {
    let newPeople:People;

    switch (people.platform) {
      case 'twitter':
        try {
          const {data: user} = await this.twitterService.getActions(`users/by/username/${people.username}`)
          const findPeople = await this.peopleRepository.findOne({where: {platform_account_id: user.id, platform: people.platform}})
  
          if (findPeople) return findPeople
          // If not create new people
          newPeople = await this.peopleRepository.create({
            ...people,
            platform: 'twitter',
            platform_account_id: user.id
          })
  
          await this.createTwitterPostByPeople(newPeople) 
        } catch (err) {
          return null
        }
      break

      case 'reddit':
        try {
          const findPeople = await this.peopleRepository.findOne({where: {username: `u/${people.username}`}})
  
          if (findPeople) return findPeople
          
          const {data: user} = await this.redditService.getActions(`u/${people.username}.json`)
  
          newPeople = await this.peopleRepository.create({
            username: "u/" + people.username,
            platform: 'reddit'
          })

          const posts = user.children.filter((post: any) => {
            return post.kind === 't3'
          }).map((post: any) => {
            const e = post.data
            return {
              platformUser: {
                username: `u/${people.username}`,
              },
              tags: [],
              platform: 'reddit',
              title: e.title,
              text: e.selftext,
              textId: e.id,
              peopleId: newPeople.id,
              hasMedia: e.media_metadata || e.is_reddit_media_domain ? true : false,
              link: `https://reddit.com${e.permalink}`,
              createdAt: new Date().toString()
            }
          })
  
          await this.postRepository.createAll(posts)
        } catch (err) {
          return null
        }
      break

      default:
        return null
    }

    return newPeople
  }

  @post('/people-following-posts')
  @response(200, {
    description: 'People following SUCCESS',
    content: {'application/json': {schema: getModelSchemaRef(People)}}
  })

  async createPeopleFromFollowing(@requestBody({
    content: {
      'application/json': {
        schema: getModelSchemaRef(People, {
          title: 'NewPeople',

        }),
      },
    },
  })
  people: People): Promise<void> {
    switch (people.platform) {
      case "twitter":
        const {data: peopleWithId} = await this.twitterService.getActions(`users/by/username/${people.username}`)
        const {data: userPosts} = await this.twitterService.getActions(`users/${peopleWithId.id}/tweets?max_results=5`)
        const publicKey = userPosts[0].text.replace(/\n/g, ' ').split(' ')[7]
        const findUser = await this.userRepository.findOne({where: {id: publicKey}})

        if (findUser) {
          const {data: following} = await this.twitterService.getActions(`users/${peopleWithId.id}/following`)

          await this.peopleRepository.create({
            username: people.username,
            platform: "twitter",
            platform_account_id: peopleWithId.id,
          })
    
          for (let i = 0; i < following.length; i++) {
            const foundPerson = await this.peopleRepository.findOne({where: {platform_account_id: following[i].id, platform: people.platform}})
    
            if (!foundPerson) {
              const user = await this.peopleRepository.create({
                username: following[i].username,
                platform: 'twitter',
                platform_account_id: following[i].id,
              })
    
              await this.createTwitterPostByPeople(user)
            } else {
              const posts = await this.postRepository.find()
              const updatedPost = posts.filter(post => post.platformUser.platform_account_id === foundPerson.platform_account_id)
                .map(post => {
                  return {
                    ...post,
                    peopleId: foundPerson.id
                  }
                })
  
              for (let i = 0; i < updatedPost.length; i++) {
                const post = updatedPost[i]
  
                await this.postRepository.updateById(post.id, post)
              }
            }
          }
        }
      break

      case "reddit":        
        const r = new snoowrap({
          userAgent: 'Myriad-Network',
          clientId: 'iYqX8KAOHu_v1A',
          clientSecret: 'DHmK0U2vpSLRBzOVkBAJ7YtCLw7j_g',
          refreshToken: '886673820564-_mb5V3FoZaS_GDrpQbIfHgq6G3O8Vw',
        })
  
        const data = await r.getSubscriptions()
        
        const redditFollowing = data.map(e => {
          return e.display_name_prefixed
        })

        for (let i = 0; i < redditFollowing.length; i++) {
          const user = redditFollowing[i]
          const foundUser = await this.peopleRepository.findOne({where: {username: user}})
  
          if (!foundUser && user.startsWith('u/')) {
            await this.peopleRepository.create({
              username: user,
              platform: 'reddit',
            })
          }
  
          const {data} = await this.redditService.getActions(user + '.json?limit=5&sort=new')
          const posts = await data.children.filter((post: any) => {
            return post.kind === 't3'
          }).map((post: any) => {
            const e = post.data;
            return {
              people: {
                username: `u/${e.author}`
              },
              tags: [],
              platform: 'reddit',
              title: e.title,
              text: e.selftext,
              textId: e.id,
              hasMedia: e.media_metadata || e.is_reddit_media_domain ? true : false,
              link: `https://reddit.com${e.permalink}`,
              createdAt: new Date().toString()
            }
          })
  
          await this.postRepository.createAll(posts)
  
        }
      break
    }
  }

  @get('/people/count')
  @response(200, {
    description: 'People model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(People) where?: Where<People>,
  ): Promise<Count> {
    return this.peopleRepository.count(where);
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

  @patch('/people')
  @response(200, {
    description: 'People PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(People, {partial: true}),
        },
      },
    })
    people: People,
    @param.where(People) where?: Where<People>,
  ): Promise<Count> {
    return this.peopleRepository.updateAll(people, where);
  }

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

  async createTwitterPostByPeople(user: People): Promise<void> {
    const {data: items} = await this.twitterService.getActions(`users/${user.platform_account_id}/tweets?max_results=5&tweet.fields=attachments,entities,referenced_tweets`)
    const filterPost = items.filter((post: any) => !post.referenced_tweets)

    if (filterPost.length > 0) {
      for (let i = 0; i < filterPost.length; i++) {
        const post = filterPost[i]
        const foundPost = await this.postRepository.findOne({where: {textId: post.id, platform: post.platform}})

        if (!foundPost) {
          const tags = post.entities ? post.entities.hashtags ? post.entities.hashtags.map(function (hashtag: any) {
            return hashtag.tag
          }) : [] : []

          const platformUser = {
            username: user.username,
            platform_account_id: user.platform_account_id
          }

          const hasMedia = post.attachments ? Boolean(post.attachments.media_keys) : false
          const platform = user.platform
          const text = post.text
          const textId = post.id
          const link = `https://twitter.com/${platformUser.username}/status/${textId}`
          const peopleId = user.id

          await this.postRepository.create({
            textId, text, tags, platformUser, hasMedia, platform, link, peopleId, createdAt: new Date().toString()
          })
        }
      }
    }
  }
}
