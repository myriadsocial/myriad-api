import {authenticate} from '@loopback/authentication';
import {intercept, service} from '@loopback/core';
import {Filter, FilterExcludingWhere} from '@loopback/repository';
import {get, getModelSchemaRef, param, response} from '@loopback/rest';
import {FindByIdInterceptor, PaginationInterceptor} from '../../interceptors';
import {Experience} from '../../models';
import {ExperienceService} from '../../services';

@authenticate('jwt')
export class ExperienceController {
  constructor(
    @service(ExperienceService)
    private experienceService: ExperienceService,
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
    @param.filter(Experience, {exclude: ['limit', 'skip', 'offset', 'where']})
    filter?: Filter<Experience>,
  ): Promise<Experience[]> {
    return this.experienceService.find(filter);
  }

  @get('/experiences/advances')
  @response(200, {
    description: 'Array of experience model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Experience, {includeRelations: true}),
        },
      },
    },
  })
  async advanced(
    @param.array('allowedTags', 'query', {type: 'string'})
    allowedTags?: string[],
    @param.array('prohibitedTags', 'query', {type: 'string'})
    prohibitedTags?: string[],
    @param.array('people', 'query', {type: 'string'})
    people?: string[],
    @param.query.number('page')
    page?: number,
    @param.query.number('limit')
    limit?: number,
  ): Promise<Experience[]> {
    return this.experienceService.findAdvanced(
      allowedTags,
      prohibitedTags,
      people,
      page,
      limit,
    );
  }

  @intercept(FindByIdInterceptor.BINDING_KEY)
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
    return this.experienceService.findById(id, filter, false);
  }
}
