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
  Content,
} from '../models';
import {UserRepository} from '../repositories';

export class UserContentController {
  constructor(
    @repository(UserRepository) protected userRepository: UserRepository,
  ) { }

  @get('/users/{id}/contents', {
    responses: {
      '200': {
        description: 'Array of User has many Content',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Content)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Content>,
  ): Promise<Content[]> {
    return this.userRepository.contents(id).find(filter);
  }

  @post('/users/{id}/contents', {
    responses: {
      '200': {
        description: 'User model instance',
        content: {'application/json': {schema: getModelSchemaRef(Content)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof User.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Content, {
            title: 'NewContentInUser',
            exclude: ['id'],
            optional: ['userId']
          }),
        },
      },
    }) content: Omit<Content, 'id'>,
  ): Promise<Content> {
    return this.userRepository.contents(id).create(content);
  }

  @patch('/users/{id}/contents', {
    responses: {
      '200': {
        description: 'User.Content PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Content, {partial: true}),
        },
      },
    })
    content: Partial<Content>,
    @param.query.object('where', getWhereSchemaFor(Content)) where?: Where<Content>,
  ): Promise<Count> {
    return this.userRepository.contents(id).patch(content, where);
  }

  @del('/users/{id}/contents', {
    responses: {
      '200': {
        description: 'User.Content DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Content)) where?: Where<Content>,
  ): Promise<Count> {
    return this.userRepository.contents(id).delete(where);
  }
}
