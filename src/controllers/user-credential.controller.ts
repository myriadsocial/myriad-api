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
  requestBody,
  response
} from '@loopback/rest';
import { xml2json } from 'xml-js';
import {UserCredential, VerifyUser} from '../models';
import {PeopleRepository, PostRepository, UserCredentialRepository} from '../repositories';
import {Reddit, Rsshub, Twitter, Facebook} from '../services';

export class UserCredentialController {
  constructor(
    @repository(UserCredentialRepository)
    public userCredentialRepository: UserCredentialRepository,
    @repository(PeopleRepository)
    public peopleRepository: PeopleRepository,
    @repository(PostRepository)
    public postRepository: PostRepository,
    @inject('services.Twitter') protected twitterService: Twitter,
    @inject('services.Reddit') protected redditService: Reddit,
    @inject('services.Rsshub') protected rsshubService: Rsshub,
    @inject('services.Facebook') protected facebookService: Facebook
  ) { }

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
  ): Promise<UserCredential> {
    const foundUserCredential = await this.userCredentialRepository.findOne({where: {userId: userCredential.userId, peopleId: userCredential.peopleId}})

    if (foundUserCredential) {
      await this.userCredentialRepository.updateById(foundUserCredential.id, userCredential)

      return userCredential
    }

    return this.userCredentialRepository.create(userCredential)
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
  ): Promise<Boolean> {
    const {userId, peopleId} = verifyUser

    try {
      const foundPeople = await this.peopleRepository.findOne({where: {id: peopleId}})
      const foundCredential = await this.userCredentialRepository.findOne({where: {userId, peopleId}})

      if (!foundPeople) return false
      if (!foundCredential) return false

      const {username, platform_account_id, platform} = foundPeople

      switch (platform) {
        case "twitter":
          const {data: tweets} = await this.twitterService.getActions(`users/${platform_account_id}}/tweets?max_results=5`)
          const twitterPublicKey = tweets[0].text.replace(/\n/g, ' ').split(' ')[7]

          if (userId === twitterPublicKey) return true
          
          await this.userCredentialRepository.deleteById(foundCredential.id)
          
          return false

        case "reddit":
          const {data: redditPosts} = await this.redditService.getActions(`u/${username}.json?limit=1`)
          const redditPublicKey = redditPosts.children[0].data.title.replace(/n/g, ' ').split(' ')[7]
          
          if (userId === redditPublicKey) return true
          
          await this.userCredentialRepository.deleteById(foundCredential.id)
          
          return false

        case "facebook":
          let facebookPublicKey = null

          const {data: facebookPosts} = await this.facebookService.getActions(platform_account_id, '')
          const publicKey = "Saying hi to #MyriadNetwork Public Key: "
          const indexFBPublicKey = facebookPosts.search(publicKey)

          if (indexFBPublicKey >= 0) {
            const index = indexFBPublicKey + publicKey.length
            facebookPublicKey = facebookPosts.substring(index, index + 49)
          }

          if (userId === facebookPublicKey) return true
          
          await this.userCredentialRepository.deleteById(foundCredential.id)
          
          return false

        default:
          return false
      }
    } catch (err) {
      return false
    }
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
