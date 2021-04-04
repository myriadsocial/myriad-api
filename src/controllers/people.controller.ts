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

  @post('/people/{platform}')
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
    // Find people in database
    const findPeople = await this.peopleRepository.find({where: {username: people.username, platform: people.platform}})

    // Find if people already in database
    if (findPeople.length > 0) return findPeople[0]
    
    let newPeople = null
    
    if (platform === 'twitter') {
      // Get platform_account_id
      const { data } = await this.twitterService.getActions(`users/by/username/${people.username}`)
      // If not create new people
      newPeople = await this.peopleRepository.create({
        ...people,
        platform_account_id: data.id
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
      const { data: peopleWithId } = await this.twitterService.getActions(`users/by/username/${people.username}`)
      const { data: following } = await this.twitterService.getActions(`users/${peopleWithId.id}/following?max_results=15`)

      for (let i = 0; i < following.length; i++) {
        const findUser = await this.peopleRepository.find({ where: { platform_account_id: following[i].id } })

        if (findUser.length === 0) {
          const user = await this.peopleRepository.create({
            username: following[i].username,
            platform: platform,
            platform_account_id: following[i].id,
          })

          await this.createPostByPeople(user)
        }
      }
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
    const { data: items } = await this.twitterService.getActions(`users/${user.platform_account_id}/tweets?max_results=15&expansions=attachments.media_keys&tweet.fields=referenced_tweets`)

    for (let i = 0; i < items.length; i++) {
      const hasMedia = Boolean(items[i].attachments)
      const tags = items[i].text.split(' ')
        .filter(function (word: string) {
          return word.startsWith('#')
        })
        .map(function (word: string) {
          return word.substr(1).trim()
        })

      if (!items[i].referenced_tweets) {
        interface Post {
          text: string,
          textId: string,
          createdAt: string,
          people?: object,
          platform: string,
          hasMedia: boolean,
          tags?: string[],
          link: string
        }
        const post:Post = {
          text: items[i].text,
          textId: items[i].id,
          createdAt: new Date().toString(),
          platform: 'twitter',
          people: {
            username: user.username,
            platform_account_id: user.platform_account_id,
          },
          hasMedia: false,
          link: `https://twitter.com/${user.username}/status/${items[i].id}`
        }

        if (hasMedia) post.hasMedia = true

        if (tags.length > 0) {
          post.tags = tags

          for (let i = 0; i < tags.length; i++) {
            const findTag = await this.tagRepository.find({
              where: { id: tags[i].toLowerCase() } 
            })

            if (findTag.length === 0) {
              await this.tagRepository.create({
                id: tags[i],
                createdAt: new Date().toString()
              })
            }
          }
        }

        this.postRepository.create(post)
      }
    }
  }
}
