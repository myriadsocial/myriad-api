import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {get, getModelSchemaRef, param, response} from '@loopback/rest';
import {defaultFilterQuery} from '../helpers/filter-utils';
import {Experience} from '../models';
import {ExperienceRepository} from '../repositories';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class ExperienceController {
  constructor(
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
  ) {}

  // TODO: moved post experience to user experiences controllers

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
    const newFilter = defaultFilterQuery(page, filter) as Filter<Experience>;

    return this.experienceRepository.find(newFilter);
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

  // TODO: moved patch experience to user experience controller

  // TODO: moved delete experience to user experience controllers

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
  async searchExperience(
    @param.query.string('q') q: string,
    @param.query.number('page') page: number,
    @param.filter(Experience, {exclude: ['where', 'skip', 'offset']}) filter?: Filter<Experience>,
  ): Promise<Experience[]> {
    if (!q) return [];

    const pattern = new RegExp('^' + q, 'i');
    const newFilter = defaultFilterQuery(page, filter, {
      name: pattern,
      origin: true,
    }) as Filter<Experience>;

    return this.experienceRepository.find(newFilter);
  }
}
