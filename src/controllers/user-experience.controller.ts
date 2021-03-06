import {intercept} from '@loopback/core';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  HttpErrors,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {ExperienceInterceptor, PaginationInterceptor} from '../interceptors';
import {Experience, UserExperience} from '../models';
import {
  ExperienceRepository,
  UserExperienceRepository,
  UserRepository,
} from '../repositories';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
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
  @post('/users/{userId}/clone-experiences/{experienceId}', {
    responses: {
      '200': {
        description: 'clone an Experience model instance',
        content: {
          'application/json': {schema: getModelSchemaRef(UserExperience)},
        },
      },
    },
  })
  async clone(
    @param.path.string('userId') userId: string,
    @param.path.string('experienceId') experienceId: string,
  ): Promise<UserExperience> {
    return this.userExperienceRepository.create(
      Object.assign(new UserExperience(), {userId, experienceId, cloned: true}),
    );
  }

  @intercept(ExperienceInterceptor.BINDING_KEY)
  @post('/users/{userId}/modify-experiences/{experienceId}', {
    responses: {
      '200': {
        description: 'modify an Experience model instance',
        content: {
          'application/json': {schema: getModelSchemaRef(UserExperience)},
        },
      },
    },
  })
  async modify(
    @param.path.string('userId') userId: string,
    @param.path.string('experienceId') experienceId: string,
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
  ): Promise<Experience> {
    await this.userExperienceRepository.deleteAll({
      userId,
      experienceId,
      cloned: true,
    });
    return this.userRepository.experiences(userId).create(experience);
  }

  // Create new experience
  @intercept(ExperienceInterceptor.BINDING_KEY)
  @post('/users/{id}/new-experiences', {
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
  ): Promise<Experience> {
    return this.userRepository.experiences(id).create(experience);
  }

  // Select experience
  @patch('/users/{userId}/select-experiencesd/{experienceId}', {
    responses: {
      '200': {
        desription: 'Select User Experience',
      },
    },
  })
  async select(
    @param.path.string('userId') userId: string,
    @param.path.string('experienceId') experienceId: string,
  ): Promise<void> {
    return this.userRepository.updateById(userId, {onTimeline: experienceId});
  }

  @patch('/users/{userId}/experiences/{experienceId}', {
    responses: {
      '204': {
        description: 'User.Experience PATCH success',
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
  ): Promise<void> {
    const userExperience = await this.userExperienceRepository.findOne({
      where: {
        userId,
        experienceId,
      },
      include: ['experience'],
    });

    if (!userExperience)
      throw new HttpErrors.UnprocessableEntity('Experience not found');

    if (userExperience.cloned)
      throw new HttpErrors.UnprocessableEntity(
        'You cannot update clone experience',
      );

    if (
      userExperience.experience &&
      userExperience.experience.createdBy !== userId
    )
      throw new HttpErrors.UnprocessableEntity(
        'You cannot update other user experience',
      );

    return this.experienceRepository.updateById(experienceId, experience);
  }

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
