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
import {Queue} from '../models';
import {QueueRepository} from '../repositories';

export class QueueController {
  constructor(
    @repository(QueueRepository)
    public queueRepository : QueueRepository,
  ) {}

  @post('/queues')
  @response(200, {
    description: 'Queue model instance',
    content: {'application/json': {schema: getModelSchemaRef(Queue)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Queue, {
            title: 'NewQueue',
            exclude: ['id'],
          }),
        },
      },
    })
    queue: Omit<Queue, 'id'>,
  ): Promise<Queue> {
    return this.queueRepository.create(queue);
  }

  @get('/queues/count')
  @response(200, {
    description: 'Queue model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Queue) where?: Where<Queue>,
  ): Promise<Count> {
    return this.queueRepository.count(where);
  }

  @get('/queues')
  @response(200, {
    description: 'Array of Queue model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Queue, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Queue) filter?: Filter<Queue>,
  ): Promise<Queue[]> {
    return this.queueRepository.find(filter);
  }

  @patch('/queues')
  @response(200, {
    description: 'Queue PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Queue, {partial: true}),
        },
      },
    })
    queue: Queue,
    @param.where(Queue) where?: Where<Queue>,
  ): Promise<Count> {
    return this.queueRepository.updateAll(queue, where);
  }

  @get('/queues/{id}')
  @response(200, {
    description: 'Queue model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Queue, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Queue, {exclude: 'where'}) filter?: FilterExcludingWhere<Queue>
  ): Promise<Queue> {
    return this.queueRepository.findById(id, filter);
  }

  @patch('/queues/{id}')
  @response(204, {
    description: 'Queue PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Queue, {partial: true}),
        },
      },
    })
    queue: Queue,
  ): Promise<void> {
    await this.queueRepository.updateById(id, queue);
  }

  @put('/queues/{id}')
  @response(204, {
    description: 'Queue PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() queue: Queue,
  ): Promise<void> {
    await this.queueRepository.replaceById(id, queue);
  }

  @del('/queues/{id}')
  @response(204, {
    description: 'Queue DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.queueRepository.deleteById(id);
  }
}
