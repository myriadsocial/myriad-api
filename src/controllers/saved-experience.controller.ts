import {
  Filter,
  FilterExcludingWhere,
  repository
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
  response
} from '@loopback/rest';
import {SavedExperience} from '../models';
import {SavedExperienceRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';

@authenticate("jwt")
export class SavedExperienceController {
  constructor(
    @repository(SavedExperienceRepository)
    public savedExperienceRepository: SavedExperienceRepository,
  ) { }

  @post('/saved-experiences')
  @response(200, {
    description: 'SavedExperience model instance',
    content: {'application/json': {schema: getModelSchemaRef(SavedExperience)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(SavedExperience, {
            title: 'NewSavedExperience',

          }),
        },
      },
    })
    savedExperience: SavedExperience,
  ): Promise<SavedExperience> {
    return this.savedExperienceRepository.create(savedExperience);
  }

  @get('/saved-experiences')
  @response(200, {
    description: 'Array of SavedExperience model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(SavedExperience, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(SavedExperience) filter?: Filter<SavedExperience>,
  ): Promise<SavedExperience[]> {
    return this.savedExperienceRepository.find(filter);
  }

  @get('/saved-experiences/{id}')
  @response(200, {
    description: 'SavedExperience model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(SavedExperience, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(SavedExperience, {exclude: 'where'}) filter?: FilterExcludingWhere<SavedExperience>
  ): Promise<SavedExperience> {
    return this.savedExperienceRepository.findById(id, filter);
  }

  @patch('/saved-experiences/{id}')
  @response(204, {
    description: 'SavedExperience PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(SavedExperience, {partial: true}),
        },
      },
    })
    savedExperience: SavedExperience,
  ): Promise<void> {
    await this.savedExperienceRepository.updateById(id, savedExperience);
  }

  @del('/saved-experiences/{id}')
  @response(204, {
    description: 'SavedExperience DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.savedExperienceRepository.deleteById(id);
  }
}
