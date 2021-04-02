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
import {RsshubUser,Twitter} from '../services';

interface PeopleFollowing {
  people: object[]
}

export class PeopleController {
  constructor(
    @repository(PeopleRepository)
    public peopleRepository : PeopleRepository,
    @repository(PostRepository)
    public postRepository : PostRepository,
    @repository(TagRepository)
    public tagRepository: TagRepository,
    @inject('services.RsshubUser') protected rsshubUserService:RsshubUser,
    @inject('services.Twitter') protected twitterService:Twitter
  ) {}

  @post('/people/twitter')
  @response(200, {
    description: 'People model instance from twitter platform',
    content: {'application/json': {schema: getModelSchemaRef(People)}},
  })
  async create(
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
  ): Promise<People> {
    // Find people in database
    const findPeople = await this.peopleRepository.find({where: {username: people.username, platform: people.platform}})

    // Find if people already in database
    if (findPeople.length > 0) return findPeople[0]
    
    // Get peopleUserId
    const { data } = await this.twitterService.getActions(`users/by/username/${people.username}`)
    // If not create new people
    const newPeople = await this.peopleRepository.create({
      ...people,
      peopleUserId: data.id
    })

    const { data: items } = await this.twitterService.getActions(`users/${newPeople.peopleUserId}/tweets?max_results=15&expansions=attachments.media_keys,author_id`)
    
    for (let i = 0; i < items.length; i++) {
      const splitText = items[i].text.split(' ')
      const link = splitText[splitText.length - 1]
      const hasMedia = Boolean(items[i].attachments)
      const tags = splitText
        .filter(function(word:string) {
          return word.startsWith('#')
        })
        .map(function(word:string){
          return word.substr(1).trim()
        })

      interface Post {
        url: string,
        createdAt: string,
        updatedAt: string,
        people: object,
        hasMedia: boolean,
        tags?: string[]
      }
      
      const post:Post = {
        url: link,
        createdAt: new Date().toString(),
        updatedAt: new Date().toString(),
        people: {
          ...people,
          peopleUserId: data.id
        },
        hasMedia: false
      }

      if (hasMedia) post.hasMedia = true

      if (tags.length > 0) {
        post.tags = tags

        for (let i = 0; i < tags.length; i++) {
          const findTag = await this.tagRepository.find({where: {id: tags[i]}})

          if (findTag.length === 0) {
            await this.tagRepository.create({
              id: tags[i],
              createdAt: new Date().toString(),
              updatedAt: new Date().toString(),
              deletedAt: new Date().toString()
            })
          }
        }
      }

      this.postRepository.create(post)
      
    }

    return newPeople
  }
  
  @post('/people/twitter/following')
  @response(200,{
    description: 'People following SUCCESS',
    content: { 'application/json': { schema: getModelSchemaRef(People) } }
  })

  async createFollowing(@requestBody({
    content: {
      'application/json': {
        schema: getModelSchemaRef(People, {
          title: 'NewPeople',

        }),
      },
    },
  })
  people: People):Promise<void> {
    const { data: peopleWithId } = await this.twitterService.getActions(`users/by/username/${people.username}`)
    const { data: following } = await this.twitterService.getActions(`users/${peopleWithId.id}/following?max_results=15`)


    for (let i = 0; i < following.length; i++) {
      const user = following[i]
      const findUser = await this.peopleRepository.find({ where: { peopleUserId: user.id } })

      if (findUser.length === 0) {
        await this.peopleRepository.create({
          username: user.username,
          platform: 'twitter',
          peopleUserId: user.id,
        })

        const { data: items } = await this.twitterService.getActions(`users/${user.id}/tweets?max_results=15&expansions=attachments.media_keys,author_id`)

        for (let i = 0; i < items.length; i++) {
          const splitText = items[i].text.split(' ')
          const link = splitText[splitText.length - 1]
          const hasMedia = Boolean(items[i].attachments)
          const tags = splitText
            .filter(function (word: string) {
              return word.startsWith('#')
            })
            .map(function (word: string) {
              return word.substr(1).trim()
            })

          interface Post {
            url: string,
            createdAt: string,
            updatedAt: string,
            people: object,
            hasMedia: boolean,
            tags?: string[]
          }

          const post: Post = {
            url: link,
            createdAt: new Date().toString(),
            updatedAt: new Date().toString(),
            people: {
              username: user.username,
              platform: 'twitter',
              peopleUserId: user.id,
            },
            hasMedia: false
          }

          if (hasMedia) post.hasMedia = true

          if (tags.length > 0) {
            post.tags = tags

            for (let i = 0; i < tags.length; i++) {
              const findTag = await this.tagRepository.find({ where: { id: tags[i] } })

              if (findTag.length === 0) {
                await this.tagRepository.create({
                  id: tags[i],
                  createdAt: new Date().toString(),
                  updatedAt: new Date().toString(),
                  deletedAt: new Date().toString()
                })
              }
            }
          }
          this.postRepository.create(post)
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
}
