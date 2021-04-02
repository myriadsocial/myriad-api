import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  response,
} from '@loopback/rest';
import {Experience} from '../models';
import {SavedExperience} from '../models'
import {ExperienceRepository} from '../repositories';

export class ExperienceController {
  constructor(
    @repository(ExperienceRepository)
    public experienceRepository : ExperienceRepository,
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
    experience: Omit<Experience, 'id'>
    // @param.filter(Experience) filter?: Filter<Experience>
  ): Promise<Experience> {
    // const newExperience = this.experienceRepository.create(experience)

    // const tags = experience.tags
    // console.log(experience.tags)

    // console.log(experience)
    

    // return this.experienceRepository.create(experience)
    return this.experienceRepository.create(experience)
    // return this.experienceRepository.find(filter)
    //   .then( experiences => {
    //     const find = experiences.find(e => e.userId === experience.userId && e.name === experience.name)

    //     if (!find) {
    //       return this.experienceRepository.create(experience)
    //     } else {
    //       this.experienceRepository.updateById(find.id, experience)
    //       return {
    //         ...experience,
    //         id: find.id
    //       }
    //     }
    //   })
  }

  @get('/experiences/count')
  @response(200, {
    description: 'Experience model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Experience) where?: Where<Experience>,
  ): Promise<Count> {
    return this.experienceRepository.count(where);
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
  async find(
    @param.filter(Experience) filter?: Filter<Experience>,
  ): Promise<Experience[]> {
    return this.experienceRepository.find(filter);
  }

  @patch('/experiences')
  @response(200, {
    description: 'Experience PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Experience, {partial: true}),
        },
      },
    })
    experience: Experience,
    @param.where(Experience) where?: Where<Experience>,
  ): Promise<Count> {
    return this.experienceRepository.updateAll(experience, where);
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
    @param.filter(Experience, {exclude: 'where'}) filter?: FilterExcludingWhere<Experience>
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
    await this.experienceRepository.updateById(id, experience);
  }

  @put('/experiences/{id}')
  @response(204, {
    description: 'Experience PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() experience: Experience,
  ): Promise<void> {
    await this.experienceRepository.replaceById(id, experience);
  }

  @del('/experiences/{id}')
  @response(204, {
    description: 'Experience DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.experienceRepository.deleteById(id);
  }
}
