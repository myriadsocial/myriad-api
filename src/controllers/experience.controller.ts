import {intercept, service} from '@loopback/core';
import {
  AnyObject,
  Filter,
  FilterExcludingWhere,
  repository,
} from '@loopback/repository';
import {
  get,
  getModelSchemaRef,
  HttpErrors,
  param,
  response,
} from '@loopback/rest';
import {FindByIdInterceptor, PaginationInterceptor} from '../interceptors';
import {Experience} from '../models';
import {ExperienceRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';
import {ExperienceService} from '../services';

@authenticate('jwt')
export class ExperienceController {
  constructor(
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
    @service(ExperienceService)
    protected experienceService: ExperienceService,
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
    @param.filter(Experience, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<Experience>,
  ): Promise<Experience[]> {
    return this.experienceRepository.find(filter);
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
    const experience = await this.experienceRepository.findOne(<AnyObject>{
      ...filter,
      where: {
        id,
        deletetAt: {
          $exists: false,
        },
      },
    });

    if (!experience) throw new HttpErrors.NotFound('Experience not found');

    await this.experienceService?.validatePrivateExperience(experience);

    return experience;
  }
}
