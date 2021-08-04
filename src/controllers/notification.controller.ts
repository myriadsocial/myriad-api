import {intercept} from '@loopback/core';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {defaultFilterQuery} from '../helpers/filter-utils';
import {PaginationInterceptor} from '../interceptors';
import {Notification} from '../models';
import {NotificationRepository} from '../repositories';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
@intercept(PaginationInterceptor.BINDING_KEY)
export class NotificationsController {
  constructor(
    @repository(NotificationRepository)
    protected notificationRepository: NotificationRepository,
  ) {}

  @post('/notifications')
  @response(200, {
    description: 'Notification model instance',
    content: {'application/json': {schema: getModelSchemaRef(Notification)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Notification, {
            title: 'NewNotification',
            exclude: ['id'],
          }),
        },
      },
    })
    notification: Omit<Notification, 'id'>,
  ): Promise<Notification> {
    return this.notificationRepository.create(notification);
  }

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
    @param.query.number('page') page: number,
    @param.filter(Notification, {exclude: ['skip', 'offset']}) filter?: Filter<Notification>,
  ): Promise<Notification[]> {
    filter = defaultFilterQuery(page, filter);
    return this.notificationRepository.find(filter);
  }

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

  @patch('/notifications/{id}')
  @response(204, {
    description: 'Notification PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Notification, {partial: true}),
        },
      },
    })
    notification: Notification,
  ): Promise<void> {
    await this.notificationRepository.updateById(id, notification);
  }

  @del('/notifications/{id}')
  @response(204, {
    description: 'Notification DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.notificationRepository.deleteById(id);
  }
}
