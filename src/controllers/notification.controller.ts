import {intercept} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  get,
  getModelSchemaRef,
  param,
  patch,
  requestBody,
  response,
} from '@loopback/rest';
import {PaginationInterceptor} from '../interceptors';
import {Notification} from '../models';
import {NotificationRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
export class NotificationController {
  constructor(
    @repository(NotificationRepository)
    protected notificationRepository: NotificationRepository,
  ) {}

  @authenticate.skip()
  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/notifications')
  @response(200, {
    description: 'Array of Notification model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Notification, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Notification, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<Notification>,
  ): Promise<Notification[]> {
    return this.notificationRepository.find(filter);
  }

  @authenticate.skip()
  @get('/notifications/{id}')
  @response(200, {
    description: 'Notification model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Notification, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Notification, {exclude: 'where'})
    filter?: FilterExcludingWhere<Notification>,
  ): Promise<Notification> {
    return this.notificationRepository.findById(id, filter);
  }

  @authenticate.skip()
  @get('/notifications/count', {
    responses: {
      '200': {
        description: 'Notifications model count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async count(
    @param.where(Notification) where?: Where<Notification>,
  ): Promise<Count> {
    return this.notificationRepository.count(where);
  }

  @patch('/notifications/{id}/read')
  @response(204, {
    description: 'Read Notification PATCH success',
  })
  async readNotification(@param.path.string('id') id: string): Promise<void> {
    await this.notificationRepository.updateById(id, {
      read: true,
      updatedAt: new Date().toString(),
    });
  }

  @patch('/notifications/read')
  @response(204, {
    description: 'Read multiple Notification PATCH success',
  })
  async readMultipleNotification(
    @requestBody({
      description: 'The input of multiple read notification',
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              title: 'NotificationId',
              type: 'string',
            },
          },
        },
      },
    })
    notificationIds: string[],
  ): Promise<Count> {
    return this.notificationRepository.updateAll(
      {read: true, updatedAt: new Date().toString()},
      {
        id: {
          inq: notificationIds,
        },
      },
    );
  }
}
