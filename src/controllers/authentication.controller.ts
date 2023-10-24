import {service} from '@loopback/core';
import {
  get,
  getModelSchemaRef,
  param,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {
  Credential,
  RequestCreateNewUserByEmail,
  RequestCreateNewUserByWallet,
  RequestOTPByEmail,
  User,
  RequestLoginByOTP,
} from '../models';
import {UserToken} from '../interfaces';
import {AuthService} from '../services';

export class AuthenticationController {
  constructor(
    @service(AuthService)
    private authService: AuthService,
  ) {}

  @get('/authentication/nonce', {
    responses: {
      '200': {
        description: 'User nonce',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                nonce: {
                  type: 'number',
                },
              },
            },
          },
        },
      },
    },
  })
  async getNonceByWallet(
    @param.query.string('id') id?: string,
    @param.query.string('type') type?: string,
  ): Promise<{nonce: number}> {
    return this.authService.getNonce(id, type);
  }

  @post('/authentication/otp/email')
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
    return this.authService.requestOTPByEmail(requestOTP);
  }

  @post('/authentication/signup/wallet')
  @response(200, {
    description: 'SIGNUP new user by wallet',
    content: {
      'application/json': {
        schema: getModelSchemaRef(User, {includeRelations: false}),
      },
    },
  })
  async signupByWallet(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(RequestCreateNewUserByWallet, {
            title: 'CreateNewUserByWallet',
          }),
        },
      },
    })
    requestCreateNewUserByWallet: RequestCreateNewUserByWallet,
  ): Promise<User> {
    return this.authService.signUpByWallet(requestCreateNewUserByWallet);
  }

  @post('/authentication/signup/email')
  @response(200, {
    description: 'SIGNUP new user by email',
    content: {
      'application/json': {
        schema: getModelSchemaRef(User, {includeRelations: false}),
      },
    },
  })
  async signupByEmail(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(RequestCreateNewUserByEmail, {
            title: 'CreateNewUserByEmailUser',
          }),
        },
      },
    })
    requestCreateNewUserByEmail: RequestCreateNewUserByEmail,
  ): Promise<User> {
    return this.authService.signUpByEmail(requestCreateNewUserByEmail);
  }

  @post('/authentication/login/wallet', {
    responses: {
      '200': {
        description: 'LOGIN by wallet',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                accessToken: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    },
  })
  async loginByWallet(
    @requestBody({
      description: 'The input of login function',
      required: true,
      content: {
        'application/json': {
          schema: getModelSchemaRef(Credential, {exclude: ['data']}),
        },
      },
    })
    credential: Credential,
  ): Promise<UserToken> {
    return this.authService.loginByWallet(credential);
  }

  @post('/authentication/login/otp')
  @response(200, {
    description: 'LOGIN by email',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            accessToken: {
              type: 'string',
            },
          },
        },
      },
    },
  })
  async loginByOTP(
    @requestBody({
      description: 'The input of login function',
      required: true,
      content: {
        'application/json': {
          schema: getModelSchemaRef(RequestLoginByOTP, {exclude: ['data']}),
        },
      },
    })
    requestLoginByOTP: RequestLoginByOTP,
  ): Promise<UserToken> {
    return this.authService.loginByEmail(requestLoginByOTP);
  }

  @post('/authentication/login/pat')
  @response(200, {
    description: 'LOGIN by personal access token',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            accessToken: {
              type: 'string',
            },
          },
        },
      },
    },
  })
  async loginByPAT(
    @requestBody({
      description: 'The input of login function',
      required: true,
      content: {
        'application/json': {
          schema: getModelSchemaRef(RequestLoginByOTP, {exclude: ['data']}),
        },
      },
    })
    requestLoginByOTP: RequestLoginByOTP,
  ): Promise<UserToken> {
    return this.authService.loginByPAT(requestLoginByOTP);
  }
}
