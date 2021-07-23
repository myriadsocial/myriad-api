import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  HttpErrors,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {Experience} from '../models';
import {ExperienceRepository} from '../repositories';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class ExperienceController {
  constructor(
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
  ) {}

  @post('/experiences')
  @response(200, {
    description: 'Experience model instance',
    content: {'application/json': {schema: getModelSchemaRef(Experience)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Experience, {
            title: 'NewExperience',
            exclude: ['id'],
          }),
        },
      },
    })
    experience: Omit<Experience, 'id'>,
  ): Promise<Experience> {
    experience.createdAt = new Date().toString();
    experience.updatedAt = new Date().toString();
    return this.experienceRepository.create(experience);
  }

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
  async find(@param.filter(Experience) filter?: Filter<Experience>): Promise<Experience[]> {
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

  @patch('/experiences/{id}')
  @response(204, {
    description: 'Experience PATCH success',
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
    experience: Experience,
  ): Promise<void> {
    const foundExperience = await this.experienceRepository.findById(id);

    if (foundExperience.creatorId !== experience.creatorId)
      throw new HttpErrors.UnprocessableEntity('This experience does not belong to you');

    experience.updatedAt = new Date().toString();

    await this.experienceRepository.updateById(id, experience);
  }

  @del('/experiences/{id}')
  @response(204, {
    description: 'Experience DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.experienceRepository.deleteById(id);
  }
}
