import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  requestBody,
} from '@loopback/rest';
import {NotificationSetting} from '../models';
import {UserRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';
import {intercept} from '@loopback/core';
import {AuthorizeInterceptor, UpdateInterceptor} from '../interceptors';

@authenticate('jwt')
@intercept(AuthorizeInterceptor.BINDING_KEY)
export class UserNotificationSettingController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
  ) {}

  @get('/users/{id}/notification-setting', {
    responses: {
      '200': {
        description: 'User has one NotificationSetting',
        content: {
          'application/json': {
            schema: getModelSchemaRef(NotificationSetting),
          },
        },
      },
    },
  })
  async get(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<NotificationSetting>,
  ): Promise<NotificationSetting> {
    return this.userRepository.notificationSetting(id).get(filter);
  }

  @intercept(UpdateInterceptor.BINDING_KEY)
  @patch('/users/{id}/notification-setting', {
    responses: {
      '200': {
        description: 'User.NotificationSetting PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(NotificationSetting, {
            partial: true,
            exclude: ['id', 'userId'],
          }),
        },
      },
    })
    notificationSetting: Partial<NotificationSetting>,
    @param.query.object('where', getWhereSchemaFor(NotificationSetting))
    where?: Where<NotificationSetting>,
  ): Promise<Count> {
    return this.userRepository
      .notificationSetting(id)
      .patch(notificationSetting, where);
  }
}
