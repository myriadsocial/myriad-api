import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {getJsonSchemaRef, HttpErrors, post, requestBody} from '@loopback/rest';
import * as _ from 'lodash';
import {PasswordHasherBindings, TokenServiceBindings, UserServiceBindings} from '../keys';
import {Authentication} from '../models';
import {Credentials, AuthenticationRepository} from '../repositories';
import {validateCredentials} from '../services';
import {BcryptHasher} from '../services/hash.password.service';
import {JWTService} from '../services/jwt.service';
import {MyAuthService} from '../services/authentication.service';
import dotenv from 'dotenv'

dotenv.config()

export class AuthenticationController {
  constructor(
    @repository(AuthenticationRepository)
    public authenticationRepository: AuthenticationRepository,

    // @inject('service.hasher')
    @inject(PasswordHasherBindings.PASSWORD_HASHER)
    public hasher: BcryptHasher,

    // @inject('service.user.service')
    @inject(UserServiceBindings.USER_SERVICE)
    public authServie: MyAuthService,

    // @inject('service.jwt.service')
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    public jwtService: JWTService,
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
    @requestBody() authData: Authentication
  ) {
    const foundAuth = await this.authenticationRepository.findOne({
      where: {
        email: authData.email
      }
    })

    if (foundAuth) {
      throw new HttpErrors.UnprocessableEntity("Email Already Exist")
    }

    validateCredentials(_.pick(authData, ['email', 'password']));
    authData.password = await this.hasher.hashPassword(authData.password)
    const savedUser = await this.authenticationRepository.create(authData);
    // delete savedUser.password;
    return {
      id: savedUser.id,
      email: savedUser.email
    }
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
                token: {
                  type: 'string'
                }
              }
            }
          }
        }
      }
    }
  })
  async login(
    @requestBody() credentials: Credentials,
  ): Promise<{access_token: string, token_type: string, expires: number}> {
    // make sure user exist,password should be valid
    const user = await this.authServie.verifyCredentials(credentials);
    // console.log(user);
    const userProfile = await this.authServie.convertToUserProfile(user);
    // console.log(userProfile);

    const token = await this.jwtService.generateToken(userProfile);
    return Promise.resolve({access_token: token, token_type: "bearer", expires: Number(process.env.TOKEN_EXPIRES_IN) * 3600})
  }
}
