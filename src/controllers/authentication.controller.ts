import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors, post, requestBody} from '@loopback/rest';
import {
  PasswordHasherBindings,
  TokenServiceBindings,
  AuthServiceBindings,
  RefreshTokenServiceBindings,
} from '../keys';
import {Authentication} from '../models';
import {Credentials, AuthenticationRepository} from '../repositories';
import {RefreshtokenService, validateCredentials} from '../services';
import {BcryptHasher} from '../services/authentication/hash.password.service';
import {JWTService} from '../services/authentication/jwt.service';
import {MyAuthService} from '../services/authentication/authentication.service';
import {NewAuthRequest, RefreshGrant, TokenObject} from '../interfaces';
import {UserProfile} from '@loopback/security';

import * as _ from 'lodash';

import dotenv from 'dotenv';

dotenv.config();

export class AuthenticationController {
  constructor(
    @repository(AuthenticationRepository)
    protected authenticationRepository: AuthenticationRepository,

    // @inject('service.hasher')
    @inject(PasswordHasherBindings.PASSWORD_HASHER)
    protected hasher: BcryptHasher,

    // @inject('service.user.service')
    @inject(AuthServiceBindings.AUTH_SERVICE)
    protected authService: MyAuthService,

    // @inject('service.jwt.service')
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    protected jwtService: JWTService,

    @inject(RefreshTokenServiceBindings.REFRESH_TOKEN_SERVICE)
    protected refreshService: RefreshtokenService,
  ) {}

  @post('/signup', {
    responses: {
      '200': {
        description: 'Authentication',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                },
                email: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    },
  })
  async signup(
    @requestBody({
      description: 'The input of signup function',
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
              email: {
                type: 'string',
                format: 'email',
              },
              password: {
                type: 'string',
                minLength: 6,
              },
            },
          },
        },
      },
    })
    newAuthRequest: NewAuthRequest,
  ): Promise<Authentication> {
    const foundAuth = await this.authenticationRepository.findOne({
      where: {
        email: newAuthRequest.email,
      },
    });

    if (foundAuth) {
      throw new HttpErrors.UnprocessableEntity('Email Already Exist');
    }

    validateCredentials(_.pick(newAuthRequest, ['email', 'password']));
    const password = await this.hasher.hashPassword(newAuthRequest.password);
    const savedUser = await this.authenticationRepository.create(
      _.omit(newAuthRequest, 'password'),
    );
    // delete savedUser.password;

    await this.authenticationRepository
      .authCredential(savedUser.id)
      .create({password});

    return savedUser;
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
                tokenType: {
                  type: 'string',
                },
                expiresIn: {
                  type: 'string',
                },
                refreshToken: {
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
          schema: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
              email: {
                type: 'string',
                format: 'email',
              },
              password: {
                type: 'string',
                minLength: 6,
              },
            },
          },
        },
      },
    })
    credentials: Credentials,
  ): Promise<TokenObject> {
    // ensure the user exists, and the password is correct
    const user = await this.authService.verifyCredentials(credentials);
    // convert a User object into a UserProfile object (reduced set of properties)
    const userProfile: UserProfile =
      this.authService.convertToUserProfile(user);
    const accessToken = await this.jwtService.generateToken(userProfile);
    const tokens = await this.refreshService.generateToken(
      userProfile,
      accessToken,
    );
    return tokens;
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
