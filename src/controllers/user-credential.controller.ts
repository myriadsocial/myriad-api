import {inject} from '@loopback/core'
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
import {UserCredential, VerifyUser} from '../models';
import {UserCredentialRepository, PeopleRepository, PostRepository} from '../repositories';
import {Reddit, Twitter, Rsshub} from '../services'

export class UserCredentialController {
  constructor(
    @repository(UserCredentialRepository)
    public userCredentialRepository : UserCredentialRepository,
    @repository(PeopleRepository)
    public peopleRepository: PeopleRepository,
    @repository(PostRepository)
    public postRepository: PostRepository,
    @inject('services.Twitter') protected twitterService: Twitter,
    @inject('services.Reddit') protected redditService: Reddit,
    @inject('services.Rsshub') protected rsshubService:Rsshub
  ) {}

  @post('/user-credentials')
  @response(200, {
    description: 'UserCredential model instance',
    content: {'application/json': {schema: getModelSchemaRef(UserCredential)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserCredential, {
            title: 'NewUserCredential',
            
          }),
        },
      },
    })
    userCredential: UserCredential,
  ): Promise<any> {
    let newUserCredential = null
    
    const foundUserCredential = await this.userCredentialRepository.findOne({where: {userId: userCredential.userId, peopleId: userCredential.peopleId}})

    if (foundUserCredential) {
      newUserCredential = await this.userCredentialRepository.updateById(foundUserCredential.id, foundUserCredential)
    }
    
    newUserCredential = await this.userCredentialRepository.create(userCredential)

    return newUserCredential
  }

  @post('/user-credentials/verify')
  @response(200, {
    desciption: `Verify User`,
    content: {'application/json': {schema: getModelSchemaRef(VerifyUser)}},
  })
  async verify(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(VerifyUser, {
            title: 'NewVerifyUser',
            
          }),
        },
      },
    }) verifyUser: VerifyUser
  ):Promise<Boolean> {
    const { userId, peopleId } = verifyUser

    try {
      const foundPeople = await this.peopleRepository.findOne({where: {id: peopleId}})

      if (!foundPeople) throw new Error('People not found')

      const {username, platform_account_id, id, platform} = foundPeople

      switch(platform) {
        case "twitter":
          const {data:tweets} = await this.twitterService.getActions(`users/${platform_account_id}}/tweets?max_results=5`)
          const twitterPublicKey = tweets[0].text.replace(/\n/g, ' ').split(' ')[7]
          const foundUserCredentialTwitter = await this.userCredentialRepository.findOne({where: {userId, peopleId: id}})

          if (foundUserCredentialTwitter) {
            if (userId === twitterPublicKey) return true
            else {
              await this.userCredentialRepository.deleteById(foundUserCredentialTwitter.id)
              await this.peopleRepository.deleteById(id)
            }
          }
        break

        case "reddit":
          const {data: redditPosts} = await this.redditService.getActions(`u/${username}.json?limit=1`)
          const redditPublicKey = redditPosts.children[0].data.title.replace(/n/g,' ').split(' ')[7]
          const foundUserCredentialReddit = await this.userCredentialRepository.findOne({where: {userId: redditPublicKey, peopleId: id}})
        
          if (foundUserCredentialReddit && userId === redditPublicKey) {
            if (userId === redditPublicKey) return true
            else {
              await this.userCredentialRepository.deleteById(foundUserCredentialReddit.id)
              await this.peopleRepository.deleteById(id)
            }
          }
        break

        case "facebook":

        break

        default:
          return false
      }
    } catch (err) {
      return false
    }

    return false
  }

  // @get('/user-credentials/count')
  // @response(200, {
  //   description: 'UserCredential model count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async count(
  //   @param.where(UserCredential) where?: Where<UserCredential>,
  // ): Promise<Count> {
  //   return this.userCredentialRepository.count(where);
  // }

  @get('/user-credentials')
  @response(200, {
    description: 'Array of UserCredential model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(UserCredential, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(UserCredential) filter?: Filter<UserCredential>,
  ): Promise<UserCredential[]> {
    return this.userCredentialRepository.find(filter);
  }

  // @patch('/user-credentials')
  // @response(200, {
  //   description: 'UserCredential PATCH success count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async updateAll(
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(UserCredential, {partial: true}),
  //       },
  //     },
  //   })
  //   userCredential: UserCredential,
  //   @param.where(UserCredential) where?: Where<UserCredential>,
  // ): Promise<Count> {
  //   return this.userCredentialRepository.updateAll(userCredential, where);
  // }

  @get('/user-credentials/{id}')
  @response(200, {
    description: 'UserCredential model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(UserCredential, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(UserCredential, {exclude: 'where'}) filter?: FilterExcludingWhere<UserCredential>
  ): Promise<UserCredential> {
    return this.userCredentialRepository.findById(id, filter);
  }

  @patch('/user-credentials/{id}')
  @response(204, {
    description: 'UserCredential PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserCredential, {partial: true}),
        },
      },
    })
    userCredential: UserCredential,
  ): Promise<void> {
    await this.userCredentialRepository.updateById(id, userCredential);
  }

  // @put('/user-credentials/{id}')
  // @response(204, {
  //   description: 'UserCredential PUT success',
  // })
  // async replaceById(
  //   @param.path.string('id') id: string,
  //   @requestBody() userCredential: UserCredential,
  // ): Promise<void> {
  //   await this.userCredentialRepository.replaceById(id, userCredential);
  // }

  @del('/user-credentials/{id}')
  @response(204, {
    description: 'UserCredential DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.userCredentialRepository.deleteById(id);
  }
}
