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
import {People} from '../models';
import {PeopleRepository, PostRepository, TagRepository} from '../repositories';
import {inject} from '@loopback/core';
import {Twitter, Reddit} from '../services';
import snoowrap from 'snoowrap'
import dotenv from 'dotenv'
import fs from 'fs'
dotenv.config()

export class PeopleController {
  constructor(
    @repository(PeopleRepository)
    public peopleRepository : PeopleRepository,
    @repository(PostRepository)
    public postRepository : PostRepository,
    @repository(TagRepository)
    public tagRepository: TagRepository,
    @inject('services.Twitter') protected twitterService:Twitter,
    @inject('services.Reddit') protected redditService:Reddit
  ) {}

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
    people:People
  ):Promise<People>{
    const [findPeople] = await this.peopleRepository.find({where: {username: people.username, platform: people.platform}})
    
    if (!findPeople) {
      people.platform_account_id = Math.floor((Math.random() * 10000000000000)).toString()
      return this.peopleRepository.create(people)
    }

    return findPeople
  }

  @post('/people/{platform}/posts')
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
    @param.path.string('platform') platform:string
  ): Promise<any> {
    let newPeople = null
    
    if (platform === 'twitter') {
      try { 
        const { data: user } = await this.twitterService.getActions(`users/by/username/${people.username}`)
        const [findPeople] = await this.peopleRepository.find({ where: { platform_account_id: user.id, platform } })

        if (findPeople) return findPeople
        // If not create new people
        newPeople = await this.peopleRepository.create({
          ...people,
          platform,
          platform_account_id: user.id
        })

        await this.createPostByPeople(newPeople)
      } catch (err) {
        return null
      }

    } 
    
    if (platform === 'reddit') {
      try {
        const { data: user } = await this.redditService.getActions(`u/${people.username}.json`)
        const findPeople = await this.peopleRepository.findOne({where: {username: `u/${people.username}`}})

        if (findPeople) return findPeople

        newPeople = await this.peopleRepository.create({
          username: "u/" + people.username,
          platform: 'reddit'
        })
        const posts = user.children.filter((post:any) => {
          return post.kind === 't3'
        }).map((post:any) => {
          const e = post.data
          return {
            people: {
              username: `u/${people.username}`,
            },
            tags: [],
            platform: 'reddit',
            title: e.title,
            text: e.selftext,
            textId: e.id,
            hasMedia: false,
            link: `https://reddit.com${e.permalink}`,
            createdAt: new Date().toString()
          }
        })

        await this.postRepository.createAll(posts)

        fs.writeFileSync('../reddit.json', JSON.stringify(posts, null, 4))
      } catch (err) {
        return null
      }
    }

    return newPeople
  }
  
  @post('/people/{platform}/following')
  @response(200,{
    description: 'People following SUCCESS',
    content: { 'application/json': { schema: getModelSchemaRef(People) } }
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
  people: People,
  @param.path.string('platform') platform: string):Promise<void> {

    if (platform === 'twitter') {
      const { data: peopleWithId } = await this.twitterService.getActions(`users/by/username/${people.username}`)
      const { data: following } = await this.twitterService.getActions(`users/${peopleWithId.id}/following`)
      console.log(following)

      for (let i = 0; i < following.length; i++) {
        const foundUser = await this.peopleRepository.findOne({ where: { platform_account_id: following[i].id, platform } })

        if (!foundUser) {
          const user = await this.peopleRepository.create({
            username: following[i].username,
            platform: platform,
            platform_account_id: following[i].id,
          })

          await this.createPostByPeople(user)
        }
      }
    }

    if (platform === 'reddit') {
      const r = new snoowrap({
        userAgent: 'Myriad-Network',
        clientId: 'iYqX8KAOHu_v1A',
        clientSecret: 'DHmK0U2vpSLRBzOVkBAJ7YtCLw7j_g',
        refreshToken: '886673820564-J6KE0yxylfBYrhxC7nZ6T8u0juH6EA'
      })

      const data = await r.getSubscriptions()
      const following = data.map( e => {
        return e.display_name_prefixed
      })

      for (let i = 0; i < following.length; i++) {
        const user = following[i]
        const foundUser = await this.peopleRepository.findOne({where: {username: user}})

        if (!foundUser && user.startsWith('u/')) {
          await this.peopleRepository.create({
            username: user,
            platform: 'reddit',
          })
        }

        const { data } = await this.redditService.getActions(user + '.json?limit=5&sort=new')
        const posts = await data.children.filter((post:any) => {
          return post.kind === 't3'
        }).map((post:any) => {
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
            hasMedia: false,
            link: `https://reddit.com${e.permalink}`,
            createdAt: new Date().toString()
          }
        })

        await this.postRepository.createAll(posts)

      }

      fs.writeFileSync('../reddit.json', JSON.stringify(following, null, 4))
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

  async createPostByPeople(user:People):Promise<void> {
    const { data: items } = await this.twitterService.getActions(`users/${user.platform_account_id}/tweets?max_results=5&tweet.fields=attachments,entities,referenced_tweets`)
    const filterPost = items.filter((post:any) => !post.referenced_tweets)

    if (filterPost.length > 0) {
      for (let i = 0; i < filterPost.length; i++) {
        const post = filterPost[i]
        const [foundPost] = await this.postRepository.find({ where: { textId: post.id, platform: post.platform}})

        if (!foundPost) {
          const tags = post.entities ? post.entities.hashtags ? post.entities.hashtags.map(function (hashtag: any) {
            return hashtag.tag
          }) : [] : []

          const people = {
            username: user.username,
            platform_account_id: user.platform_account_id
          }

          const hasMedia = post.attachments ? Boolean(post.attachments.media_keys) : false
          const platform = user.platform
          const text = post.text
          const textId = post.id
          const link = `https://twitter.com/${people.username}/status/${textId}`
          
          await this.postRepository.create({
            textId, text, tags, people, hasMedia, platform, link, createdAt: new Date().toString()
          })
        }
      }
    }
  }
}
