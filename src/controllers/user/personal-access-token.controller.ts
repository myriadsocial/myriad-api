import {service} from '@loopback/core';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  del,
  requestBody,
  response,
} from '@loopback/rest';
import {
  CreateUserPersonalAccessTokenDto,
  UpdateUserPersonalAccessTokenDto,
  UserPersonalAccessToken,
} from '../../models';
import {UserService} from '../../services';
import {authenticate} from '@loopback/authentication';
import {Count} from '@loopback/repository';

@authenticate('jwt')
export class UserPersonalAccessTokenController {
  constructor(
    @service(UserService)
    private userService: UserService,
  ) {}

  @post('/user/personal-access-tokens')
  @response(200, {
    description: 'CREATE user personal-access-tokens',
    content: {
      'application/json': {schema: getModelSchemaRef(UserPersonalAccessToken)},
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(CreateUserPersonalAccessTokenDto, {
            title: 'NewUserPersonalAccessToken',
          }),
        },
      },
    })
    data: CreateUserPersonalAccessTokenDto,
  ): Promise<UserPersonalAccessToken> {
    return this.userService.createAccessToken(data);
  }

  @get('/user/personal-access-tokens')
  @response(200, {
    description: 'GET user personal-access-token',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(UserPersonalAccessToken, {
            includeRelations: false,
          }),
        },
      },
    },
  })
  async find(): Promise<UserPersonalAccessToken[]> {
    return this.userService.accessTokens();
  }

  @del('/user/personal-access-tokens/{id}')
  @response(204, {
    description: 'REMOVE user personal-access-token',
  })
  async deleteById(@param.path.string('id') id: string): Promise<Count> {
    return this.userService.removeAccessToken(id);
  }
}
