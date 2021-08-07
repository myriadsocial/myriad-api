import {intercept} from '@loopback/core';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {get, getModelSchemaRef, param, response} from '@loopback/rest';
import {PaginationInterceptor} from '../interceptors';
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
}
