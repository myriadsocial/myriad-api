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
import {inject} from '@loopback/core';
import {LoggingBindings, logInvocation, WinstonLogger} from '@loopback/logging';

@authenticate('jwt')
export class UserNotificationSettingController {
  // Inject a winston logger
  @inject(LoggingBindings.WINSTON_LOGGER)
  private logger: WinstonLogger;

  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
  ) {}

  @logInvocation()
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

  @logInvocation()
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
          schema: getModelSchemaRef(NotificationSetting, {partial: true}),
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
