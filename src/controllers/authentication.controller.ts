import {inject, intercept, service} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  getModelSchemaRef,
  param,
  post,
  response,
  requestBody,
  get,
  HttpErrors,
} from '@loopback/rest';
import {UserProfile} from '@loopback/security';
import {RefreshGrant, TokenObject} from '../interfaces';
import {RefreshTokenServiceBindings, TokenServiceBindings} from '../keys';
import {
  Credential,
  RequestCreateNewUserByEmail,
  RequestCreateNewUserByWallet,
  RequestOtpw,
  User,
} from '../models';
import {
  NetworkRepository,
  UserRepository,
  WalletRepository,
} from '../repositories';
import {RefreshtokenService} from '../services';
import {JWTService} from '../services/authentication/jwt.service';
import {AuthenticationInterceptor} from '../interceptors';
import {pick} from 'lodash';
import {UserOtpwRepository} from '../repositories/user-otpw.repository';
import {UserOtpw} from '../models/user-otpw.model';
import {EmailService} from '../services/email.service';
import {RequestLoginByEmail} from '../models/request-login-by-email.model';
import validator from 'validator';

export class AuthenticationController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(UserOtpwRepository)
    protected userOtpwRepository: UserOtpwRepository,
    @repository(NetworkRepository)
    protected networkRepository: NetworkRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
    @service(EmailService)
    protected emailService: EmailService,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    protected jwtService: JWTService,
    @inject(RefreshTokenServiceBindings.REFRESH_TOKEN_SERVICE)
    protected refreshService: RefreshtokenService,
  ) {}

  @get('/wallets/{id}/nonce', {
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
    @param.path.string('id') id: string,
  ): Promise<{nonce: number}> {
    const result = {nonce: 0};

    try {
      const user = await this.walletRepository.user(id);
      result.nonce = user.nonce;
    } catch {
      // ignore
    }

    return result;
  }

  @get('/users/{id}/nonce', {
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
  async getNonceByUser(
    @param.path.string('id') id: string,
    @param.query.string('platform') platform?: string,
  ): Promise<{nonce: number}> {
    if (!platform) {
      const {nonce} = await this.userRepository.findById(id);
      return {nonce};
    }

    const networks = await this.networkRepository.find({
      where: {blockchainPlatform: platform},
    });
    const networkIds = networks.map(network => network.id);
    const wallet = await this.walletRepository.findOne({
      where: {networkId: {inq: networkIds}, userId: id},
    });

    if (!wallet) return {nonce: 0};

    const {nonce} = await this.userRepository.findById(id);
    return {nonce};
  }

  @get('/username/{username}')
  @response(200, {
    description: 'Get username',
    content: {
      'application/json': {
        schema: {
          type: 'boolean',
        },
      },
    },
  })
  async username(
    @param.path.string('username') username: string,
  ): Promise<boolean> {
    const user = await this.userRepository.findOne({where: {username}});

    return Boolean(user);
  }

  @post('/email/otpw')
  @response(200, {
    description: 'Request OTPW Response',
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
  async requestOTPW(
    @requestBody({
      description: 'The input of request OTPW',
      required: true,
      content: {
        'application/json': {
          schema: getModelSchemaRef(RequestOtpw),
        },
      },
    })
    requestOtpw: RequestOtpw,
  ): Promise<{message: string}> {
    if (!validator.isEmail(requestOtpw.email)) {
      throw new HttpErrors.UnprocessableEntity('Invalid Email Address');
    }

    const user = await this.userRepository.findOne({
      where: {email: requestOtpw.email},
    });

    if (!user) throw new HttpErrors.NotFound('Account not exist');

    await this.userOtpwRepository.deleteAll({
      userId: user.id,
    });

    const userOtpw = new UserOtpw();
    userOtpw.userId = user.id;

    const otpw = await this.userOtpwRepository.create(userOtpw);

    await this.emailService.sendOTPW(user, otpw.id);

    return {
      message: `OTPW sent to ${requestOtpw.email}`,
    };
  }

  @intercept(AuthenticationInterceptor.BINDING_KEY)
  @post('/signup')
  @response(200, {
    description: 'User model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(User, {includeRelations: false}),
      },
    },
  })
  async signup(
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
    const user = pick(requestCreateNewUserByWallet, [
      'name',
      'username',
      'permissions',
    ]);
    return this.userRepository.create(user);
  }

  @intercept(AuthenticationInterceptor.BINDING_KEY)
  @post('/signup/email')
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
    const user = pick(requestCreateNewUserByEmail, [
      'name',
      'username',
      'email',
    ]);
    return this.userRepository.create(user);
  }

  @intercept(AuthenticationInterceptor.BINDING_KEY)
  @post('/login', {
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
  async login(
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
    const accessToken = await this.jwtService.generateToken(
      credential.data as UserProfile,
    );

    return {accessToken};
  }

  @intercept(AuthenticationInterceptor.BINDING_KEY)
  @post('/login/email', {
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
  async loginByEmail(
    @requestBody({
      description: 'The input of login function',
      required: true,
      content: {
        'application/json': {
          schema: getModelSchemaRef(RequestLoginByEmail, {exclude: ['data']}),
        },
      },
    })
    requestLoginByEmail: RequestLoginByEmail,
  ): Promise<TokenObject> {
    const accessToken = await this.jwtService.generateToken(
      requestLoginByEmail.data as UserProfile,
    );

    return {accessToken};
  }

  @post('/refresh', {
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
              },
            },
          },
        },
      },
    },
  })
  async refresh(
    @requestBody({
      description: 'Reissuing Acess Token',
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['refreshToken'],
            properties: {
              refreshToken: {
                type: 'string',
              },
            },
          },
        },
      },
    })
    refreshGrant: RefreshGrant,
  ): Promise<TokenObject> {
    return this.refreshService.refreshToken(refreshGrant.refreshToken);
  }
}
