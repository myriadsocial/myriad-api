import {authenticate} from '@loopback/authentication';
import {intercept, service} from '@loopback/core';
import {Count, CountSchema, Filter, Where} from '@loopback/repository';
import {get, getModelSchemaRef, param, patch, response} from '@loopback/rest';
import {PaginationInterceptor} from '../../interceptors';
import {Notification} from '../../models';
import {UserService} from '../../services';

@authenticate('jwt')
export class NotificationController {
  constructor(
    @service(UserService)
    private userService: UserService,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/user/notifications')
  @response(200, {
    description: 'GET user notifications',
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
    return this.userService.notifications(filter);
  }

  @get('/user/notifications/count', {
    responses: {
      '200': {
        description: 'COUNT user notifications',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async count(
    @param.where(Notification) where?: Where<Notification>,
  ): Promise<Count> {
    return this.userService.notificationCount(where);
  }

  @patch('/user/notifications/read')
  @response(204, {
    description: 'READ user notification',
  })
  async readNotification(@param.query.string('id') id?: string): Promise<void> {
    await this.userService.readNotifications(id);
  }
}
