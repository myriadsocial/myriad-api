import {intercept} from '@loopback/core';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {get, getModelSchemaRef, param, patch, requestBody, response} from '@loopback/rest';
import {ExperienceInterceptor, PaginationInterceptor} from '../interceptors';
import {CustomFilter, Experience, ExtendCustomFilter} from '../models';
import {ExperienceRepository} from '../repositories';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class ExperienceController {
  constructor(
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/experiences')
  @response(200, {
    description: 'Array of Experience model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Experience, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.query.object('filter', getModelSchemaRef(CustomFilter)) filter: CustomFilter,
  ): Promise<Experience[]> {
    return this.experienceRepository.find(filter as Filter<Experience>);
  }

  @get('/experiences/{id}')
  @response(200, {
    description: 'Experience model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Experience, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Experience, {exclude: 'where'})
    filter?: FilterExcludingWhere<Experience>,
  ): Promise<Experience> {
    return this.experienceRepository.findById(id, filter);
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/search-experiences')
  @response(200, {
    description: 'Array of Experience model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Experience),
        },
      },
    },
  })
  async search(
    @param.query.object(
      'filter',
      getModelSchemaRef(ExtendCustomFilter, {exclude: ['findBy', 'sortBy', 'where']}),
    )
    filter: ExtendCustomFilter,
  ): Promise<Experience[]> {
    return this.experienceRepository.find(filter as Filter<Experience>);
  }

  // Modify from other experience
  @intercept(ExperienceInterceptor.BINDING_KEY)
  @patch('/modify-experiences/{experienceId}', {
    responses: {
      '200': {
        description: 'modify an Experience',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Experience),
          },
        },
      },
    },
  })
  async modify(
    @param.path.string('experienceId') experienceId: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Experience, {
            title: 'NewModifyExperienceInUser',
            exclude: ['cloned', 'origin', 'createdAt', 'updatedAt', 'clonedFrom'],
            partial: true,
          }),
        },
      },
    })
    experience: Partial<Experience>,
  ): Promise<void> {
    return this.experienceRepository.updateById(experienceId, experience);
  }

  @intercept(ExperienceInterceptor.BINDING_KEY)
  @patch('/experiences/{id}', {
    responses: {
      '204': {
        description: 'User.Experience PATCH success count',
      },
    },
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
  ): Promise<void> {
    return this.experienceRepository.updateById(id, experience);
  }
}
