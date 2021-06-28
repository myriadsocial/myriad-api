import {
  authenticate,
  TokenService,
  UserService,
} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  getJsonSchemaRef, 
  HttpErrors, 
  post, 
  requestBody} from '@loopback/rest';
import {
  PasswordHasherBindings, 
  TokenServiceBindings, 
  AuthServiceBindings, 
  RefreshTokenServiceBindings
} from '../keys';
import {Authentication} from '../models';
import {Credentials, AuthenticationRepository} from '../repositories';
import {RefreshtokenService, validateCredentials} from '../services';
import {BcryptHasher} from '../services/hash.password.service';
import {JWTService} from '../services/jwt.service';
import {MyAuthService} from '../services/authentication.service';
import {RefreshTokenService, TokenObject} from '../interfaces';
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';

import * as _ from 'lodash';

import dotenv from 'dotenv'

dotenv.config()

type RefreshGrant = {
  refreshToken: string;
};

export class AuthenticationController {
  constructor(
    @repository(AuthenticationRepository)
    public authenticationRepository: AuthenticationRepository,

    // @inject('service.hasher')
    @inject(PasswordHasherBindings.PASSWORD_HASHER)
    public hasher: BcryptHasher,

    // @inject('service.user.service')
    @inject(AuthServiceBindings.AUTH_SERVICE)
    public authService: MyAuthService,

    // @inject('service.jwt.service')
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    public jwtService: JWTService,

    @inject(RefreshTokenServiceBindings.REFRESH_TOKEN_SERVICE)
    public refreshService: RefreshtokenService,
    
    @inject(SecurityBindings.USER, {optional: true})
    private auth: UserProfile,
  ) {}

  @post('/signup', {
    responses: {
      '200': {
        description: 'Authentication',
        content: {
          schema: getJsonSchemaRef(Authentication)
        }
      }
    }
  })
  async signup(
    @requestBody() newUserRequest: {email: string, password: string},
  ):Promise<Authentication> {
    const foundAuth = await this.authenticationRepository.findOne({
      where: {
        email: newUserRequest.email
      }
    })

    if (foundAuth) {
      throw new HttpErrors.UnprocessableEntity("Email Already Exist")
    }

    validateCredentials(_.pick(newUserRequest, ['email', 'password']));
    const password = await this.hasher.hashPassword(newUserRequest.password)
    const savedUser = await this.authenticationRepository.create(
      _.omit(newUserRequest, 'password')
    );
    // delete savedUser.password;

    await this.authenticationRepository.authCredential(savedUser.id).create({password});

    return savedUser
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
              },
            },
          },
        },
      },
    },
  })
  async refreshLogin(
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
          }
        },
      },
    }) credentials: Credentials,
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
                  type: 'object',
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
          }
        },
      },
    }) refreshGrant: {refreshToken: string},
  ): Promise<TokenObject> {
    return this.refreshService.refreshToken(refreshGrant.refreshToken);
  }
}
