import {repository} from '@loopback/repository';
import {
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {TokenObject} from '../interfaces';
import {Credential} from '../models';
import {UserRepository} from '../repositories';
import {inject, intercept} from '@loopback/core';
import {TokenServiceBindings} from '../keys';
import {JWTService} from '../services';
import {UserProfile} from '@loopback/security';
import {AuthenticationInterceptor} from '../interceptors';
import {PermissionKeys} from '../enums';
import {authenticate} from '@loopback/authentication';
import {union} from 'lodash';

export class AdminController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    protected jwtService: JWTService,
  ) {}

  @intercept(AuthenticationInterceptor.BINDING_KEY)
  @post('/admin/login', {
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
  async adminLogin(
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

  @authenticate({strategy: 'jwt', options: {required: [PermissionKeys.ADMIN]}})
  @patch('/admin/{userId}')
  @response(204, {
    description: 'Role PATCH success',
  })
  async patch(@param.path.string('userId') userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    const permissions = union(user.permissions, [PermissionKeys.ADMIN]);

    return this.userRepository.updateById(userId, {permissions});
  }
}
