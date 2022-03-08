import {intercept} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {
  ExperienceInterceptor,
  FindByIdInterceptor,
  PaginationInterceptor,
} from '../interceptors';
import {Experience, UserExperience} from '../models';
import {
  ExperienceRepository,
  UserExperienceRepository,
  UserRepository,
} from '../repositories';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
export class UserExperienceController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(UserExperienceRepository)
    protected userExperienceRepository: UserExperienceRepository,
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/user-experiences', {
    responses: {
      '200': {
        description: 'Array of UserExperience model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(UserExperience, {
                includeRelations: true,
              }),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(UserExperience, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<UserExperience>,
  ): Promise<UserExperience[]> {
    return this.userExperienceRepository.find(filter);
  }

  @intercept(FindByIdInterceptor.BINDING_KEY)
  @get('/user-experiences/{id}')
  @response(200, {
    description: 'UserExperience model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(UserExperience, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(UserExperience, {exclude: 'where'})
    filter?: FilterExcludingWhere<UserExperience>,
  ): Promise<UserExperience> {
    return this.userExperienceRepository.findById(id, filter);
  }

  @intercept(ExperienceInterceptor.BINDING_KEY)
  @post('/users/{userId}/subscribe/{experienceId}', {
    responses: {
      '200': {
        description: 'subscribe an Experience model instance',
        content: {
          'application/json': {schema: getModelSchemaRef(UserExperience)},
        },
      },
    },
  })
  async subscribe(
    @param.path.string('userId') userId: string,
    @param.path.string('experienceId') experienceId: string,
  ): Promise<UserExperience> {
    return this.userExperienceRepository.create(
      Object.assign(new UserExperience(), {
        userId,
        experienceId,
        subscribed: true,
      }),
    );
  }

  // Create new experience
  @intercept(ExperienceInterceptor.BINDING_KEY)
  @post('/users/{id}/experiences', {
    responses: {
      '200': {
        description: 'create an Experience model instance',
        content: {'application/json': {schema: getModelSchemaRef(Experience)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Experience, {
            title: 'NewExperienceInUser',
            optional: ['createdBy'],
          }),
        },
      },
    })
    experience: Omit<Experience, 'id'>,
    @param.query.string('experienceId') experienceId?: string,
  ): Promise<Experience> {
    return this.userRepository.experiences(id).create(experience);
  }

  @intercept(ExperienceInterceptor.BINDING_KEY)
  @patch('/users/{userId}/experiences/{experienceId}', {
    responses: {
      '204': {
        description: 'Experience model count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async updateExperience(
    @param.path.string('userId') userId: string,
    @param.path.string('experienceId') experienceId: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Experience, {partial: true}),
        },
      },
    })
    experience: Partial<Experience>,
  ): Promise<Count> {
    return this.userRepository
      .experiences(userId)
      .patch(experience, {id: experienceId});
  }

  @intercept(ExperienceInterceptor.BINDING_KEY)
  @del('/user-experiences/{id}', {
    responses: {
      '200': {
        description: 'User.Experience DELETE success count',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    return this.userExperienceRepository.deleteById(id);
  }
}
