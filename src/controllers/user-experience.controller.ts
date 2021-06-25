import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  HttpErrors,
  param,
  patch,
  post,
  requestBody
} from '@loopback/rest';
import {Experience, User} from '../models';
import {UserRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';

@authenticate("jwt")
export class UserExperienceController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
  ) { }

  @get('/users/{id}/experiences', {
    responses: {
      '200': {
        description: 'Array of User has many Experience through SavedExperience',
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
    return this.userRepository.savedExperiences(id).find(filter);
  }

  @post('/users/{id}/experiences', {
    responses: {
      '200': {
        description: 'create a Experience model instance',
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
          }),
        },
      },
    }) experience: Omit<Experience, 'id'>,
  ): Promise<Experience> {
    try {
      const newExperience = await this.userRepository.savedExperiences(id).create({
        ...experience,
        userId: id,
        createdAt: new Date().toString(),
        updatedAt: new Date().toString()
      });

      return newExperience

    } catch (err) {
      throw new HttpErrors.UnprocessableEntity("Experience already exists")
    }
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
    return this.userRepository.savedExperiences(id).patch({
      ...experience,
      updatedAt: new Date().toString()
    }, where);
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
    return this.userRepository.savedExperiences(id).delete(where);
  }
}
