import {
  Filter,
  FilterExcludingWhere,
  repository
} from '@loopback/repository';
import {
  del, get,
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
  response,
  HttpErrors
} from '@loopback/rest';
import {Experience} from '../models';
import {ExperienceRepository} from '../repositories';

export class ExperienceController {
  constructor(
    @repository(ExperienceRepository)
    public experienceRepository: ExperienceRepository,
  ) { }

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
  ): Promise<Experience> {
    return this.experienceRepository.create({
      ...experience,
      createdAt: new Date().toString(),
      updatedAt: new Date().toString()
    })
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
    const foundExperience = await this.experienceRepository.findOne({where: {id}})

    if (!foundExperience) throw new HttpErrors.NotFound("Experience does not exists")

    if (foundExperience.userId !== experience.userId) throw new HttpErrors.UnprocessableEntity("This experience does not belong to you")
    
    await this.experienceRepository.updateById(id, {
      ...experience,
      updatedAt: new Date().toString()
    });
  }

  @del('/experiences/{id}')
  @response(204, {
    description: 'Experience DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.experienceRepository.deleteById(id);
  }
  // @get('/experiences/count')
  // @response(200, {
  //   description: 'Experience model count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async count(
  //   @param.where(Experience) where?: Where<Experience>,
  // ): Promise<Count> {
  //   return this.experienceRepository.count(where);
  // }

  // @patch('/experiences')
  // @response(200, {
  //   description: 'Experience PATCH success count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async updateAll(
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(Experience, {partial: true}),
  //       },
  //     },
  //   })
  //   experience: Experience,
  //   @param.where(Experience) where?: Where<Experience>,
  // ): Promise<Count> {
  //   return this.experienceRepository.updateAll(experience, where);
  // }

  // @put('/experiences/{id}')
  // @response(204, {
  //   description: 'Experience PUT success',
  // })
  // async replaceById(
  //   @param.path.string('id') id: string,
  //   @requestBody() experience: Experience,
  // ): Promise<void> {
  //   await this.experienceRepository.replaceById(id, experience);
  // }

}
