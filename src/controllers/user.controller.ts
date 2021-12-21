import {inject, intercept} from '@loopback/core';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {DeletedDocument, PaginationInterceptor} from '../interceptors';
import {User} from '../models';
import {UserRepository} from '../repositories';
import {UserWallet} from '../models/user-wallet.model';
import {authenticate} from '@loopback/authentication';
import {LoggingBindings, logInvocation, WinstonLogger} from '@loopback/logging';

@authenticate('jwt')
export class UserController {
  // Inject a winston logger
  @inject(LoggingBindings.WINSTON_LOGGER)
  private logger: WinstonLogger;

  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
  ) {}

  @logInvocation()
  @post('/users')
  @response(200, {
    description: 'User model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(User),
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserWallet, {
            title: 'NewUser',
          }),
        },
      },
    })
    userWallet: UserWallet,
  ): Promise<User> {
    const {name, username} = userWallet;
    return this.userRepository.create({name, username});
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @logInvocation()
  @get('/users')
  @response(200, {
    description: 'Array of User model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(User, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(User, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<User>,
  ): Promise<User[]> {
    return this.userRepository.find(filter);
  }

  @intercept(DeletedDocument.BINDING_KEY)
  @logInvocation()
  @get('/users/{id}')
  @response(200, {
    description: 'User model instance',
    content: {
      'application/json': {
        //TODO: hide password from response
        schema: getModelSchemaRef(User, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(User, {exclude: 'where'}) filter?: FilterExcludingWhere<User>,
  ): Promise<User> {
    return this.userRepository.findById(id, filter);
  }

  @logInvocation()
  @patch('/users/{id}')
  @response(204, {
    description: 'User PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(User, {
            partial: true,
            exclude: ['id', 'defaultCurrency', 'onTimeline', 'deletedAt'],
          }),
        },
      },
    })
    user: Partial<User>,
  ): Promise<void> {
    await this.userRepository.updateById(id, user);
  }
}
