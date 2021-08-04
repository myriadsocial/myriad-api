import {intercept} from '@loopback/core';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {get, getModelSchemaRef, param, response} from '@loopback/rest';
import {defaultFilterQuery} from '../helpers/filter-utils';
import {PaginationInterceptor} from '../interceptors';
import {Experience} from '../models';
import {ExperienceRepository} from '../repositories';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")

@intercept(PaginationInterceptor.BINDING_KEY)
export class ExperienceController {
  constructor(
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
  ) {}

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
    @param.query.number('page') page: number,
    @param.filter(Experience, {exclude: ['skip', 'offset']}) filter?: Filter<Experience>,
  ): Promise<Experience[]> {
    filter = defaultFilterQuery(page, filter);
    return this.experienceRepository.find(filter);
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

  // Search experience
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
    @param.query.string('q') q: string,
    @param.query.number('page') page: number,
    @param.filter(Experience, {exclude: ['where', 'skip', 'offset']}) filter?: Filter<Experience>,
  ): Promise<Experience[]> {
    if (!q) return [];

    filter = defaultFilterQuery(page, filter);
    console.log(filter);

    const pattern = new RegExp('^' + q, 'i');
    return this.experienceRepository.find({
      ...filter,
      where: {
        name: pattern,
        origin: true,
      },
      fields: ['id', 'name'],
    } as Filter<Experience>);
  }
}
