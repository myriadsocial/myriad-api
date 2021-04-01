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
Experience,
SavedExperience,
User,
} from '../models';
import {ExperienceRepository} from '../repositories';

export class ExperienceUserController {
  constructor(
    @repository(ExperienceRepository) protected experienceRepository: ExperienceRepository,
  ) { }

  @get('/experiences/{id}/users', {
    responses: {
      '200': {
        description: 'Array of Experience has many User through SavedExperience',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(User)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<User>,
  ): Promise<User[]> {
    return this.experienceRepository.savedUsers(id).find(filter);
  }

  @post('/experiences/{id}/users', {
    responses: {
      '200': {
        description: 'create a User model instance',
        content: {'application/json': {schema: getModelSchemaRef(User)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Experience.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(User, {
            title: 'NewUserInExperience',
            exclude: ['id'],
          }),
        },
      },
    }) user: Omit<User, 'id'>,
  ): Promise<User> {
    return this.experienceRepository.savedUsers(id).create(user);
  }

  @patch('/experiences/{id}/users', {
    responses: {
      '200': {
        description: 'Experience.User PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(User, {partial: true}),
        },
      },
    })
    user: Partial<User>,
    @param.query.object('where', getWhereSchemaFor(User)) where?: Where<User>,
  ): Promise<Count> {
    return this.experienceRepository.savedUsers(id).patch(user, where);
  }

  @del('/experiences/{id}/users', {
    responses: {
      '200': {
        description: 'Experience.User DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(User)) where?: Where<User>,
  ): Promise<Count> {
    return this.experienceRepository.savedUsers(id).delete(where);
  }
}
