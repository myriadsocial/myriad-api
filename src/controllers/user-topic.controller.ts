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
  Topic,
} from '../models';
import {UserRepository} from '../repositories';

export class UserTopicController {
  constructor(
    @repository(UserRepository) protected userRepository: UserRepository,
  ) { }

  @get('/users/{id}/topics', {
    responses: {
      '200': {
        description: 'Array of User has many Topic',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Topic)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Topic>,
  ): Promise<Topic[]> {
    return this.userRepository.topics(id).find(filter);
  }

  @post('/users/{id}/topics', {
    responses: {
      '200': {
        description: 'User model instance',
        content: {'application/json': {schema: getModelSchemaRef(Topic)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof User.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Topic, {
            title: 'NewTopicInUser',
            exclude: ['id'],
            optional: ['userId']
          }),
        },
      },
    }) topic: Omit<Topic, 'id'>,
  ): Promise<Topic> {
    return this.userRepository.topics(id).create(topic);
  }

  @patch('/users/{id}/topics', {
    responses: {
      '200': {
        description: 'User.Topic PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Topic, {partial: true}),
        },
      },
    })
    topic: Partial<Topic>,
    @param.query.object('where', getWhereSchemaFor(Topic)) where?: Where<Topic>,
  ): Promise<Count> {
    return this.userRepository.topics(id).patch(topic, where);
  }

  @del('/users/{id}/topics', {
    responses: {
      '200': {
        description: 'User.Topic DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Topic)) where?: Where<Topic>,
  ): Promise<Count> {
    return this.userRepository.topics(id).delete(where);
  }
}
