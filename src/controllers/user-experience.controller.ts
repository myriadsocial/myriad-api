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
  Experience,
} from '../models';
import {UserRepository} from '../repositories';

export class UserExperienceController {
  constructor(
    @repository(UserRepository) protected userRepository: UserRepository,
  ) { }

  @get('/users/{id}/experiences', {
    responses: {
      '200': {
        description: 'Array of User has many Experience',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Experience)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Experience>,
  ): Promise<Experience[]> {
    return this.userRepository.experiences(id).find(filter);
  }

  @post('/users/{id}/experiences', {
    responses: {
      '200': {
        description: 'User model instance',
        content: {'application/json': {schema: getModelSchemaRef(Experience)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof User.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Experience, {
            title: 'NewExperienceInUser',
            exclude: ['id'],
            optional: ['userId']
          }),
        },
      },
    }) experience: Omit<Experience, 'id'>,
  ): Promise<Experience> {
    return this.userRepository.experiences(id).create(experience);
  }

  @patch('/users/{id}/experiences', {
    responses: {
      '200': {
        description: 'User.Experience PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Experience, {partial: true}),
        },
      },
    })
    experience: Partial<Experience>,
    @param.query.object('where', getWhereSchemaFor(Experience)) where?: Where<Experience>,
  ): Promise<Count> {
    return this.userRepository.experiences(id).patch(experience, where);
  }

  @del('/users/{id}/experiences', {
    responses: {
      '200': {
        description: 'User.Experience DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Experience)) where?: Where<Experience>,
  ): Promise<Count> {
    return this.userRepository.experiences(id).delete(where);
  }
}
