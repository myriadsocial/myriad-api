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

@authenticate('jwt')
export class UserNotificationSettingController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
  ) {}

  @authenticate.skip()
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
