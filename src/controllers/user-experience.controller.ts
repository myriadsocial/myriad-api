import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
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
  requestBody,
  response,
} from '@loopback/rest';
import {Experience, User, UserExperience} from '../models';
import {ExperienceRepository, UserExperienceRepository, UserRepository} from '../repositories';
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

  @get('/users/{id}/experiences', {
    responses: {
      '200': {
        description:
          'Array of User has many Experience through UserExperience',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(UserExperience)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.filter(UserExperience, {exclude: 'where'}) filter?: FilterExcludingWhere<UserExperience>,
  ): Promise<UserExperience[]> {
    return this.userExperienceRepository.find({
      ...filter,
      where: {
        userId: id
      }
    });
  }

  @get('/users/{id}/select-experience/{experienceId}', {
    responses: {
      '200': {
        desription: 'Select Experience',
      }
    }
  })
  async selectExperience(
    @param.path.string('id') id: string,
    @param.path.string('experienceId') experienceId: string,
  ): Promise<Count> {
    const userExperience = await this.userExperienceRepository.findOne({
      where: {
        userId: id,
        experienceId
      }
    })

    if (userExperience) throw new HttpErrors.NotFound('User experience not found');

    await this.userExperienceRepository.updateAll({
      hasSelected: false
    }, {
      userId: id
    })

    return this.userExperienceRepository.updateAll({
      hasSelected: true
    }, {
      userId: id,
      experienceId
    })
  }

  @get('/users/{id}/clone-experience/{experienceId}', {
    responses: {
      '200': {
        description: 'Clone experience',
        content: {'application/json': {schema: getModelSchemaRef(Experience)}},
      }
    }
  })
  async cloneExperience(
    @param.path.string('id') id: string,
    @param.path.string('experienceId') experienceId: string
  ): Promise<Experience> {
    const {count} = await this.userExperienceRepository.count({userId: id});

    if (count >= 10) {
      throw new HttpErrors.UnprocessableEntity('Experience must not exceed 10 experiences');
    }

    const experience = await this.experienceRepository.findById(experienceId);
    experience.cloned = experience.cloned + 1;

    this.experienceRepository.updateById(experience.id, {cloned: experience.cloned})
    this.userExperienceRepository.updateAll({hasSelected: false},{userId: id})
    this.userExperienceRepository.create({
      userId: id,
      experienceId,
      hasSelected: true
    })
    return experience
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
    @param.query.string('experienceId') experienceId: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Experience, {
            title: 'NewExperienceInUser',
            exclude: ['id'],
          }),
        },
      },
    })
    experience: Omit<Experience, 'id'>,
  ): Promise<Experience> {
    experience.createdAt = new Date().toString();
    experience.updatedAt = new Date().toString();
    experience.creatorId = id;

    if (experienceId) {
      this.userExperienceRepository.deleteAll({
        userId: id,
        experienceId
      })
    } else {
      const {count} = await this.userExperienceRepository.count({
        userId: id,
      })

      if (count >= 10) {
        throw new HttpErrors.UnprocessableEntity('Experience must not exceed 10 experiences');
      }
    }

    this.userExperienceRepository.updateAll({hasSelected: false}, {userId: id});

    return this.userRepository
      .userExperiences(id)
      .create(experience);
  }

  @patch('/users/{id}/experiences/{experienceId}', {
    responses: {
      '200': {
        description: 'User.Experience PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
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
    const foundExperience = await this.experienceRepository.findById(experienceId);

    if (foundExperience.creatorId !== id) {
      throw new HttpErrors.UnprocessableEntity("This experience does not belong to you!");
    }

    experience.updatedAt = new Date().toString();
    return this.experienceRepository.updateById(experienceId, experience);
  }

  @del('/users/{id}/experiences/{experienceId}', {
    responses: {
      '200': {
        description: 'User.Experience DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.path.string('experienceId') experienceId: string,
  ): Promise<Count> {
    const experience = await this.experienceRepository.findById(experienceId)

    if (experience.creatorId === id) {
      this.experienceRepository.deleteById(experience.id);
    }

    return this.userExperienceRepository.deleteAll({
      userId: id,
      experienceId
    })
  }

  @post('/user-experiences')
  @response(200, {
    description: 'UserExperience model instance',
    content: {'application/json': {schema: getModelSchemaRef(UserExperience)}},
  })
  async createUserExperience(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserExperience, {
            title: 'NewUserExperience',
          }),
        },
      },
    })
    userExperience: UserExperience,
  ): Promise<UserExperience> {
    return this.userExperienceRepository.create(userExperience);
  }

  @get('/user-experiences')
  @response(200, {
    description: 'Array of UserExperience model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(UserExperience, {includeRelations: true}),
        },
      },
    },
  })
  async findUserExperience(
    @param.filter(UserExperience) filter?: Filter<UserExperience>,
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
}
