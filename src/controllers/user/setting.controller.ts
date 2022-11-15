import {authenticate} from '@loopback/authentication';
import {service} from '@loopback/core';
import {
  del,
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {RequestOTPByEmail, UserByEmail} from '../../models';
import {UserService} from '../../services/user.service';

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
}
