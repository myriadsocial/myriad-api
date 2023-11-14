import {authenticate} from '@loopback/authentication';
import {intercept, service} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
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
import {FindByIdInterceptor, PaginationInterceptor} from '../../interceptors';
import {Experience, UserExperience} from '../../models';
import {UserService} from '../../services';

@authenticate('jwt')
export class UserExperienceController {
  constructor(
    @service(UserService)
    private userService: UserService,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/user/experiences')
  @response(200, {
    description: 'GET user-experiences',
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
  })
  async find(
    @param.filter(UserExperience, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<UserExperience>,
  ): Promise<UserExperience[]> {
    return this.userService.userExperiences(filter);
  }

  @intercept(FindByIdInterceptor.BINDING_KEY)
  @get('/user/experiences/{id}')
  @response(200, {
    description: 'GET user-experience',
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
    return this.userService.userExperience(id, filter);
  }

  @del('/user/experiences/{id}')
  @response(204, {
    description: 'UNSUBSCRIBE user experience',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    return this.userService.unsubscribeExperience(id);
  }

  @post('/user/experiences/{id}/subscribe')
  @response(200, {
    description: 'SUBSCRIBE user experience',
    content: {
      'application/json': {schema: getModelSchemaRef(UserExperience)},
    },
  })
  async subscribe(
    @param.path.string('id') id: string,
  ): Promise<UserExperience> {
    return this.userService.subscribeExperience(id);
  }

  @post('/user/experiences')
  @response(200, {
    description: 'CREATE user experience',
    content: {'application/json': {schema: getModelSchemaRef(Experience, {includeRelations: true})}},
  })
  async create(
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
    @param.array('editors', 'query', {type: 'string'}) editors?: string[]
  ): Promise<Experience> {
    if (editors) {
    }
    return this.userService.createExperience(experience, experienceId, editors);
  }

  @patch('/user/experiences/{id}')
  @response(204, {
    description: 'UPDATE user experience',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Experience, {partial: true}),
        },
      },
    })
    experience: Partial<Experience>,
  ): Promise<Count> {
    return this.userService.updateExperience(id, experience);
  }
}
