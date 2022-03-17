import {inject, intercept} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  getModelSchemaRef,
  param,
  post,
  response,
  requestBody,
  get,
} from '@loopback/rest';
import {UserProfile} from '@loopback/security';
import {RefreshGrant, TokenObject} from '../interfaces';
import {RefreshTokenServiceBindings, TokenServiceBindings} from '../keys';
import {Credential, User, UserWallet} from '../models';
import {UserRepository, WalletRepository} from '../repositories';
import {RefreshtokenService} from '../services';
import {JWTService} from '../services/authentication/jwt.service';
import {AuthenticationInterceptor} from '../interceptors';
import {pick} from 'lodash';

export class AuthenticationController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
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
  ): Promise<{nonce: number}> {
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

  @intercept(AuthenticationInterceptor.BINDING_KEY)
  @post('/signup')
  @response(200, {
    description: 'User model instance',
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
  })
  async signup(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserWallet, {
            title: 'NewUser',
          }),
        },
      },
    })
    userWallet: UserWallet,
  ): Promise<User> {
    const user = pick(userWallet, ['name', 'username']);
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
