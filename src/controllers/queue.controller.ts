import {
  Filter,
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
  response,
} from '@loopback/rest';
import {Queue} from '../models';
import {QueueRepository} from '../repositories';

export class QueueController {
  constructor(
    @repository(QueueRepository)
    public queueRepository : QueueRepository,
  ) {}

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
}
