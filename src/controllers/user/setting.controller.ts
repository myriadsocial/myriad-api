import {authenticate} from '@loopback/authentication';
import {service} from '@loopback/core';
import {Count, CountSchema} from '@loopback/repository';
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
import {
  AccountSetting,
  LanguageSetting,
  NotificationSetting,
  RequestOTPByEmail,
  UserByEmail,
} from '../../models';
import {UserService} from '../../services';

@authenticate('jwt')
export class SettingController {
  constructor(
    @service(UserService)
    private userService: UserService,
  ) {}

  @post('/user/otp/email')
  @response(200, {
    description: 'Request OTP by Email Response',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
            },
          },
        },
      },
    },
  })
  async requestOTPByEmail(
    @requestBody({
      description: 'The input of request OTP by Email',
      required: true,
      content: {
        'application/json': {
          schema: getModelSchemaRef(RequestOTPByEmail),
        },
      },
    })
    requestOTP: RequestOTPByEmail,
  ): Promise<{message: string}> {
    return this.userService.requestOTPByEmail(requestOTP);
  }

  @patch('/user/email-setting')
  @response(204, {
    description: 'UPDATE user email-setting',
  })
  async setEmailSetting(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserByEmail),
        },
      },
    })
    userByEmail: UserByEmail,
  ) {
    return this.userService.setEmailSetting(userByEmail);
  }

  @del('/user/email-setting')
  @response(200, {
    description: 'REMOVE user email-setting',
  })
  async removeEmailSetting(
    @param.query.string('token') token?: string,
  ): Promise<void> {
    return this.userService.setEmailSetting({token});
  }

  @get('/user/language-setting')
  @response(200, {
    description: 'GET user language-setting',
    content: {
      'application/json': {
        schema: getModelSchemaRef(LanguageSetting),
      },
    },
  })
  async languageSetting(): Promise<LanguageSetting> {
    return this.userService.languageSetting();
  }

  @patch('/user/language-setting')
  @response(200, {
    description: 'SET user language-setting',
    content: {'application/json': {schema: CountSchema}},
  })
  async setLanguageSetting(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(LanguageSetting, {partial: true}),
        },
      },
    })
    languageSetting: Partial<LanguageSetting>,
  ): Promise<Count> {
    return this.userService.setLanguageSetting(languageSetting);
  }

  @get('/user/notification-setting')
  @response(200, {
    description: 'GET user notification-setting',
    content: {
      'application/json': {
        schema: getModelSchemaRef(NotificationSetting),
      },
    },
  })
  async notificationSetting(): Promise<NotificationSetting> {
    return this.userService.notificationSetting();
  }

  @patch('/user/notification-setting')
  @response(200, {
    description: 'SET user notification-setting',
    content: {'application/json': {schema: CountSchema}},
  })
  async setNotificationSetting(
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
  ): Promise<Count> {
    return this.userService.setNotificationSetting(notificationSetting);
  }

  @get('/user/account-setting')
  @response(200, {
    description: 'GET user account-setting',
    content: {
      'application/json': {
        schema: getModelSchemaRef(AccountSetting),
      },
    },
  })
  async accountSetting(): Promise<AccountSetting> {
    return this.userService.accountSetting();
  }

  @patch('/user/account-setting')
  @response(204, {
    description: 'SET user account-setting',
    content: {'application/json': {schema: CountSchema}},
  })
  async patch(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(AccountSetting, {
            partial: true,
            exclude: ['id', 'userId'],
          }),
        },
      },
    })
    accountSetting: Partial<AccountSetting>,
  ): Promise<Count> {
    return this.userService.setAccountSetting(accountSetting);
  }
}
