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
import {Credential, User} from '../models';
import {UserRepository} from '../repositories';
import {RefreshtokenService} from '../services';
import {JWTService} from '../services/authentication/jwt.service';
import {AuthenticationInterceptor} from '../interceptors';

export class AuthenticationController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    protected jwtService: JWTService,
    @inject(RefreshTokenServiceBindings.REFRESH_TOKEN_SERVICE)
    protected refreshService: RefreshtokenService,
  ) {}

  @get('/users/{id}/nonce', {
    responses: {
      '200': {
        desciption: 'User nonce',
        content: {
          'application/json': {
            schema: {
              type: 'number',
            },
          },
        },
      },
    },
  })
  async getNonce(@param.path.string('id') id: string): Promise<number | null> {
    let result = null;

    try {
      ({nonce: result} = await this.userRepository.findById(id));
    } catch {
      // ignore
    }

    return result;
  }

  @intercept(AuthenticationInterceptor.BINDING_KEY)
  @post('/signup')
  @response(200, {
    description: 'User model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(User, {
          exclude: ['nonce'],
        }),
      },
    },
  })
  async signup(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(User, {
            title: 'NewUser',
            exclude: [
              'profilePictureURL',
              'bannerImageUrl',
              'fcmTokens',
              'onTimeline',
              'createdAt',
              'updatedAt',
              'nonce',
              'deletedAt',
            ],
          }),
        },
      },
    })
    user: User,
  ): Promise<User> {
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
