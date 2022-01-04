import {inject, intercept} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  getModelSchemaRef,
  HttpErrors,
  param,
  post,
  response,
  requestBody,
  get,
} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {RefreshGrant, TokenObject} from '../interfaces';
import {RefreshTokenServiceBindings, TokenServiceBindings} from '../keys';
import {Credential, User} from '../models';
import {UserRepository} from '../repositories';
import {RefreshtokenService} from '../services';
import {JWTService} from '../services/authentication/jwt.service';
import {numberToHex} from '@polkadot/util';
import {signatureVerify} from '@polkadot/util-crypto';
import NonceGenerator from 'a-nonce-generator';

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

  @intercept(CreateInterceptor.BINDING_KEY)
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
  async create(
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
          schema: getModelSchemaRef(Credential),
        },
      },
    })
    credential: Credential,
  ): Promise<TokenObject> {
    const {nonce, signature, publicAddress} = credential;

    const {isValid} = signatureVerify(
      numberToHex(nonce),
      signature,
      publicAddress,
    );

    if (!isValid) {
      throw new HttpErrors.UnprocessableEntity('Invalid user!');
    }

    const user = await this.userRepository.findById(publicAddress);

    if (user.nonce !== nonce) {
      throw new HttpErrors.UnprocessableEntity('Invalid user!');
    }

    const userProfile: UserProfile = {
      [securityId]: user.id!.toString(),
      id: user.id,
      name: user.name,
      username: user.username,
    };

    const accessToken = await this.jwtService.generateToken(userProfile);
    const token = await this.refreshService.generateToken(
      userProfile,
      accessToken,
    );

    const ng = new NonceGenerator();
    const newNonce = ng.generate();

    await this.userRepository.updateById(publicAddress, {nonce: newNonce});

    return token;
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
