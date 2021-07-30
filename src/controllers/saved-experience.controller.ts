import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
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
import {UserExperience} from '../models';
import {UserExperienceRepository} from '../repositories';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class SavedExperienceController {
  constructor(
    @repository(UserExperienceRepository)
    protected userExperienceRepository: UserExperienceRepository,
  ) {}

  @post('/user-experiences')
  @response(200, {
    description: 'UserExperience model instance',
    content: {'application/json': {schema: getModelSchemaRef(UserExperience)}},
  })
  async create(
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
  async find(
    @param.filter(UserExperience) filter?: Filter<UserExperience>,
  ): Promise<UserExperience[]> {
    return this.userExperienceRepository.find(filter);
  }

  @get('/user-experiences/{id}')
  @response(200, {
    description: 'SavedExperience model instance',
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

  @patch('/user-experiences/{id}')
  @response(204, {
    description: 'SavedExperience PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserExperience, {partial: true}),
        },
      },
    })
    userExperience: UserExperience,
  ): Promise<void> {
    await this.userExperienceRepository.updateById(id, userExperience);
  }

  @del('/user-experiences/{id}')
  @response(204, {
    description: 'UserExperience DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.userExperienceRepository.deleteById(id);
  }
}
