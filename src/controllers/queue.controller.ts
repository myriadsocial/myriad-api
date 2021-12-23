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
import {inject} from '@loopback/core';
import {LoggingBindings, logInvocation, WinstonLogger} from '@loopback/logging';

@authenticate('jwt')
export class QueueController {
  // Inject a winston logger
  @inject(LoggingBindings.WINSTON_LOGGER)
  private logger: WinstonLogger;

  constructor(
    @repository(QueueRepository)
    protected queueRepository: QueueRepository,
  ) {}

  @logInvocation()
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

  @logInvocation()
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
