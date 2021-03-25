import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import {
  User,
  UserIdentity,
} from '../models';
import {UserRepository} from '../repositories';

export class UserUserIdentityController {
  constructor(
    @repository(UserRepository) protected userRepository: UserRepository,
  ) { }

  @get('/users/{id}/user-identities', {
    responses: {
      '200': {
        description: 'Array of User has many UserIdentity',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(UserIdentity)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<UserIdentity>,
  ): Promise<UserIdentity[]> {
    return this.userRepository.userIdentities(id).find(filter);
  }

  @post('/users/{id}/user-identities', {
    responses: {
      '200': {
        description: 'User model instance',
        content: {'application/json': {schema: getModelSchemaRef(UserIdentity)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof User.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserIdentity, {
            title: 'NewUserIdentityInUser',
            exclude: ['id'],
            optional: ['userId']
          }),
        },
      },
    }) userIdentity: Omit<UserIdentity, 'id'>,
  ): Promise<UserIdentity> {
    return this.userRepository.userIdentities(id).create(userIdentity);
  }

  @patch('/users/{id}/user-identities', {
    responses: {
      '200': {
        description: 'User.UserIdentity PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserIdentity, {partial: true}),
        },
      },
    })
    userIdentity: Partial<UserIdentity>,
    @param.query.object('where', getWhereSchemaFor(UserIdentity)) where?: Where<UserIdentity>,
  ): Promise<Count> {
    return this.userRepository.userIdentities(id).patch(userIdentity, where);
  }

  @del('/users/{id}/user-identities', {
    responses: {
      '200': {
        description: 'User.UserIdentity DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(UserIdentity)) where?: Where<UserIdentity>,
  ): Promise<Count> {
    return this.userRepository.userIdentities(id).delete(where);
  }
}
