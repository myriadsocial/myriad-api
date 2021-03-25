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
  Platform,
} from '../models';
import {UserRepository} from '../repositories';

export class UserPlatformController {
  constructor(
    @repository(UserRepository) protected userRepository: UserRepository,
  ) { }

  @get('/users/{id}/platforms', {
    responses: {
      '200': {
        description: 'Array of User has many Platform',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Platform)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Platform>,
  ): Promise<Platform[]> {
    return this.userRepository.platforms(id).find(filter);
  }

  @post('/users/{id}/platforms', {
    responses: {
      '200': {
        description: 'User model instance',
        content: {'application/json': {schema: getModelSchemaRef(Platform)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof User.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Platform, {
            title: 'NewPlatformInUser',
            exclude: ['id'],
            optional: ['userId']
          }),
        },
      },
    }) platform: Omit<Platform, 'id'>,
  ): Promise<Platform> {
    return this.userRepository.platforms(id).create(platform);
  }

  @patch('/users/{id}/platforms', {
    responses: {
      '200': {
        description: 'User.Platform PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Platform, {partial: true}),
        },
      },
    })
    platform: Partial<Platform>,
    @param.query.object('where', getWhereSchemaFor(Platform)) where?: Where<Platform>,
  ): Promise<Count> {
    return this.userRepository.platforms(id).patch(platform, where);
  }

  @del('/users/{id}/platforms', {
    responses: {
      '200': {
        description: 'User.Platform DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Platform)) where?: Where<Platform>,
  ): Promise<Count> {
    return this.userRepository.platforms(id).delete(where);
  }
}
