import {intercept, service} from '@loopback/core';
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
} from '../../models';
import {TokenObject} from '../../interfaces';
import {AuthenticationInterceptor} from '../../interceptors';
import {AuthService} from '../../services';

export class AuthenticationController {
  constructor(
    @service(AuthService)
    private authService: AuthService,
  ) {}

  @get('/auth/nonce', {
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

  @post('/auth/otp/email')
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

  @intercept(AuthenticationInterceptor.BINDING_KEY)
  @post('/auth/signup/wallet')
  @response(200, {
    description: 'User model instance',
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

  @intercept(AuthenticationInterceptor.BINDING_KEY)
  @post('/auth/signup/email')
  @response(200, {
    description: 'User model instance',
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

  @intercept(AuthenticationInterceptor.BINDING_KEY)
  @post('/auth/login/wallet', {
    responses: {
      '200': {
        description: 'Token',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                accessToken: {
                  type: 'string',
                },
                refreshToken: {
                  type: 'string',
                },
                expiresId: {
                  type: 'string',
                },
                tokenType: {
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
  ): Promise<TokenObject> {
    return this.authService.login(credential);
  }

  @intercept(AuthenticationInterceptor.BINDING_KEY)
  @post('/auth/login/otp')
  @response(200, {
    description: 'Token',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            accessToken: {
              type: 'string',
            },
            refreshToken: {
              type: 'string',
            },
            expiresId: {
              type: 'string',
            },
            tokenType: {
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
  ): Promise<TokenObject> {
    return this.authService.login(requestLoginByOTP);
  }
}
