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
import {PublicMetric} from '../models';
import {PublicMetricRepository} from '../repositories';

export class PublicMetricController {
  constructor(
    @repository(PublicMetricRepository)
    public publicMetricRepository : PublicMetricRepository,
  ) {}

  @post('/public-metrics')
  @response(200, {
    description: 'PublicMetric model instance',
    content: {'application/json': {schema: getModelSchemaRef(PublicMetric)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(PublicMetric, {
            title: 'NewPublicMetric',
            exclude: ['id'],
          }),
        },
      },
    })
    publicMetric: Omit<PublicMetric, 'id'>,
  ): Promise<PublicMetric> {
    return this.publicMetricRepository.create(publicMetric);
  }

  @get('/public-metrics/count')
  @response(200, {
    description: 'PublicMetric model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(PublicMetric) where?: Where<PublicMetric>,
  ): Promise<Count> {
    return this.publicMetricRepository.count(where);
  }

  @get('/public-metrics')
  @response(200, {
    description: 'Array of PublicMetric model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(PublicMetric, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(PublicMetric) filter?: Filter<PublicMetric>,
  ): Promise<PublicMetric[]> {
    return this.publicMetricRepository.find(filter);
  }

  @patch('/public-metrics')
  @response(200, {
    description: 'PublicMetric PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(PublicMetric, {partial: true}),
        },
      },
    })
    publicMetric: PublicMetric,
    @param.where(PublicMetric) where?: Where<PublicMetric>,
  ): Promise<Count> {
    return this.publicMetricRepository.updateAll(publicMetric, where);
  }

  @get('/public-metrics/{id}')
  @response(200, {
    description: 'PublicMetric model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(PublicMetric, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(PublicMetric, {exclude: 'where'}) filter?: FilterExcludingWhere<PublicMetric>
  ): Promise<PublicMetric> {
    return this.publicMetricRepository.findById(id, filter);
  }

  @patch('/public-metrics/{id}')
  @response(204, {
    description: 'PublicMetric PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(PublicMetric, {partial: true}),
        },
      },
    })
    publicMetric: PublicMetric,
  ): Promise<void> {
    await this.publicMetricRepository.updateById(id, publicMetric);
  }

  @put('/public-metrics/{id}')
  @response(204, {
    description: 'PublicMetric PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() publicMetric: PublicMetric,
  ): Promise<void> {
    await this.publicMetricRepository.replaceById(id, publicMetric);
  }

  @del('/public-metrics/{id}')
  @response(204, {
    description: 'PublicMetric DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.publicMetricRepository.deleteById(id);
  }
}
