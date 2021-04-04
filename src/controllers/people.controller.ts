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
import {Twitter} from '../services';
import TwitterLib from 'twitter';
import dotenv from 'dotenv'

dotenv.config()

export class PeopleController {
  constructor(
    @repository(PeopleRepository)
    public peopleRepository : PeopleRepository,
    @repository(PostRepository)
    public postRepository : PostRepository,
    @repository(TagRepository)
    public tagRepository: TagRepository,
    @inject('services.Twitter') protected twitterService:Twitter
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
      // Get platform_account_id
      const { data:user } = await this.twitterService.getActions(`users/by/username/${people.username}`)
      const [findPeople] = await this.peopleRepository.find({where: {platform_account_id: user.id, platform}})

      if (findPeople) return findPeople
      // If not create new people
      newPeople = await this.peopleRepository.create({
        ...people,
        platform,
        platform_account_id: user.id
      })

      await this.createPostByPeople(newPeople)
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
      const client = new TwitterLib({
        consumer_key: 'EP3yMA4CwxhgnF57GRgaBP89u',
        consumer_secret: 'R2dxXblRWnrF7rBEcKY1mZI3sHYv01sI9zZYz9sNUdIVznHgRA',
        access_token_key: '2246250000-JsoqCHp9UYWE3c0CLaxI1rEUCl22FLmC5tPVpwF',
        access_token_secret: 'nue3TlbcIuVZMkPX0nNsxeNlzC0ORLanTkoXq9uRZmdtb'
      })

      const params = {screen_name: people.username}
      client.get('statuses/user_timeline', params, (err, tweets, res) => {
        if (!err) {
          console.log(tweets)
          // const posts = []
          // tweets.forEach(tweet => {
          //   if (!tweet.retweeted_status) {
          //     posts.push({
          //       tags: tweet.entities.hashtags.map(hashtag => {
          //         return {
          //           id: hashtag.text,
          //           hide: false
          //         }
          //       }),
          //       people: {
          //         username: tweet.user.screen_name,
          //         platform_account_id: tweet.user.id_str,
          //       },
          //       platform: 'twitter',
          //       hasMedia: Boolean(tweet.entities.media),
          //       platform_post_id: tweet.id_str,
          //       url: `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`
          //     })
          //   }
          // })
          // fs.writeFileSync('example.json', JSON.stringify(posts, null, 4))
        }
      })

      // const { data: peopleWithId } = await this.twitterService.getActions(`users/by/username/${people.username}`)
      // const { data: following } = await this.twitterService.getActions(`users/${peopleWithId.id}/following?max_results=15`)

      // for (let i = 0; i < following.length; i++) {
      //   const findUser = await this.peopleRepository.find({ where: { platform_account_id: following[i].id, platform } })

      //   if (findUser.length === 0) {
      //     const user = await this.peopleRepository.create({
      //       username: following[i].username,
      //       platform: platform,
      //       platform_account_id: following[i].id,
      //     })

      //     await this.createPostByPeople(user)
      //   }
      // }
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
    const { data: items } = await this.twitterService.getActions(`users/${user.platform_account_id}/tweets?max_results=15&tweet.fields=attachments,entities,referenced_tweets`)
    const filterPost = items.filter((post:any) => !post.referenced_tweets)

    for (let i = 0; i < filterPost.length; i++) {
      const post = filterPost[i]

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

      for (let i = 0; i < tags.length; i++) {
        const tag = tags[i]
        const [findTag] = await this.tagRepository.find({where: {id: tag.toLowerCase()}})
        
        if (!findTag) {
          await this.tagRepository.create({
            id: tag.toLowerCase(),
            createdAt: new Date().toString()
          })
        }
      }

      const [findPost] = await this.postRepository.find({where: {textId: post.id, platform}})

      if (!findPost) await this.postRepository.create({
        textId, text, tags, people, hasMedia, platform, link, createdAt: new Date().toString()
      })
    }
  }
}
