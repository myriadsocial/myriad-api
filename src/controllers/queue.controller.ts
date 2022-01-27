import {Filter, repository} from '@loopback/repository';
import {
  get,
  getModelSchemaRef,
  param,
  patch,
  requestBody,
  response,
} from '@loopback/rest';
import {Queue} from '../models';
import {QueueRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
export class QueueController {
  constructor(
    @repository(QueueRepository)
    protected queueRepository: QueueRepository,
  ) {}

  @authenticate.skip()
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
  async find(@param.filter(Queue) filter?: Filter<Queue>): Promise<Queue[]> {
    return this.queueRepository.find(filter);
  }

  @patch('/queues/{id}')
  @response(200, {
    description: 'Update',
  })
  async update(
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
    return this.queueRepository.updateById(id, queue);
  }
}
