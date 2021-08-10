import {intercept} from '@loopback/core';
import {Count, CountSchema, Filter, repository} from '@loopback/repository';
import {del, get, getModelSchemaRef, param, patch, post, requestBody} from '@loopback/rest';
import {StatusType} from '../enums';
import {ExperienceInterceptor, PaginationInterceptor} from '../interceptors';
import {CustomFilter, Experience, UserExperience} from '../models';
import {ExperienceRepository, UserExperienceRepository, UserRepository} from '../repositories';
import {approvedUpdate} from '../utils/filter-utils';
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
            schema: {type: 'array', items: getModelSchemaRef(UserExperience)},
          },
        },
      },
    },
  })
  async find(
    @param.query.object('filter', getModelSchemaRef(CustomFilter)) filter: CustomFilter,
  ): Promise<UserExperience[]> {
    return this.userExperienceRepository.find(filter as Filter<UserExperience>);
  }

  @intercept(ExperienceInterceptor.BINDING_KEY)
  @post('/clone-user-experiences', {
    responses: {
      '200': {
        description: 'clone an Experience model instance',
        content: {'application/json': {schema: getModelSchemaRef(Experience)}},
      },
    },
  })
  async clone(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserExperience, {
            title: 'NewCloneExperienceInUser',
            exclude: ['id', 'clonedFrom'],
          }),
        },
      },
    })
    userExperience: Omit<UserExperience, 'id'>,
  ): Promise<UserExperience> {
    return this.userExperienceRepository.create(userExperience);
  }

  // Create new experience
  @intercept(ExperienceInterceptor.BINDING_KEY)
  @post('/user-experiences', {
    responses: {
      '200': {
        description: 'create an Experience model instance',
        content: {'application/json': {schema: getModelSchemaRef(Experience)}},
      },
    },
  })
  async createNew(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Experience, {
            title: 'NewExperienceInUser',
            exclude: ['id', 'cloned', 'origin', 'clonedFrom'],
          }),
        },
      },
    })
    experience: Omit<Experience, 'id'>,
  ): Promise<Experience> {
    return this.userRepository.experiences(experience.createdBy).create(experience);
  }

  // Select experience
  @patch('/user/{userId}/select-experience/{experienceId}', {
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

  // Approve or reject other user experience
  @patch('/update-user-experience', {
    responses: {
      '204': {
        description: 'Patch other User Experience',
      },
    },
  })
  async update(
    @param.query.boolean('updated') updated: boolean,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserExperience, {
            title: 'UserExperience',
            exclude: ['id', 'clonedFrom', 'status'],
          }),
        },
      },
    })
    userExperience: Omit<UserExperience, 'id'>,
  ): Promise<Count> {
    const {userId, experienceId} = userExperience;
    const experience = await this.experienceRepository.findById(experienceId);

    if (updated) {
      experience.tags = approvedUpdate(experience.tags, true);
      experience.people = approvedUpdate(experience.people, true);
      experience.updatedAt = new Date().toString();
    } else {
      experience.tags = approvedUpdate(experience.tags, false);
      experience.people = approvedUpdate(experience.people, false);
    }

    this.experienceRepository.updateById(experience.id, experience) as Promise<void>;

    return this.userExperienceRepository.updateAll(
      {status: updated ? StatusType.UPDATED : StatusType.NONE},
      {userId, experienceId},
    );
  }

  @del('/user-experiences/{id}', {
    responses: {
      '200': {
        description: 'User.Experience DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    return this.userExperienceRepository.deleteById(id);
  }
}
