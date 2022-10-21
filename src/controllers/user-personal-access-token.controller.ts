import {inject} from '@loopback/core';
import {Filter, repository} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  del,
  requestBody,
  response,
  HttpErrors,
} from '@loopback/rest';
import {TokenServiceBindings} from '../keys';
import {UserPersonalAccessToken} from '../models';
import {UserPersonalAccessTokenRepository} from '../repositories';
import {JWTService} from '../services';
import {securityId, UserProfile} from '@loopback/security';
import {AuthenticationBindings} from '@loopback/authentication';

export class UserPersonalAccessTokenController {
  constructor(
    @repository(UserPersonalAccessTokenRepository)
    public userPersonalAccessTokenRepository: UserPersonalAccessTokenRepository,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    protected jwtService: JWTService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    public currentUser: UserProfile,
  ) {}

  @post('/users/{userId}/personal-access-tokens')
  @response(200, {
    description: 'UserPersonalAccessToken model instance',
    content: {
      'application/json': {schema: getModelSchemaRef(UserPersonalAccessToken)},
    },
  })
  async create(
    @param.path.string('userId') userId: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserPersonalAccessToken, {
            title: 'NewUserPersonalAccessToken',
            exclude: [
              'id',
              'token',
              'userId',
              'createdAt',
              'updatedAt',
              'deletedAt',
            ],
          }),
        },
      },
    })
    userPersonalAccessToken: Omit<UserPersonalAccessToken, 'id'>,
  ): Promise<UserPersonalAccessToken> {
    if (userId !== this.currentUser[securityId])
      throw new HttpErrors.Unauthorized();

    const accessToken = await this.jwtService.generateToken(this.currentUser);

    userPersonalAccessToken.token = accessToken;
    userPersonalAccessToken.userId = userId;

    return this.userPersonalAccessTokenRepository.create(
      userPersonalAccessToken,
    );
  }

  @get('/users/{userId}/personal-access-tokens')
  @response(200, {
    description: 'Array of UserPersonalAccessToken model instances',
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
  async find(
    @param.path.string('userId') userId: string,
    @param.filter(UserPersonalAccessToken, {exclude: ['include']})
    filter?: Filter<UserPersonalAccessToken>,
  ): Promise<UserPersonalAccessToken[]> {
    if (userId !== this.currentUser[securityId])
      throw new HttpErrors.Unauthorized();

    return this.userPersonalAccessTokenRepository.find(filter);
  }

  @patch('/users/{userId}/personal-access-tokens/{id}')
  @response(204, {
    description: 'UserPersonalAccessToken PATCH success',
  })
  async updateById(
    @param.path.string('userId') userId: string,
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserPersonalAccessToken, {
            partial: true,
            exclude: [
              'id',
              'token',
              'description',
              'userId',
              'createdAt',
              'updatedAt',
              'deletedAt',
            ],
          }),
        },
      },
    })
    userPersonalAccessToken: Omit<UserPersonalAccessToken, 'id'>,
  ): Promise<void> {
    if (userId !== this.currentUser[securityId])
      throw new HttpErrors.Unauthorized();

    const pat = await this.userPersonalAccessTokenRepository.findOne({
      where: {
        id: id,
        userId: userId,
      },
    });

    if (!pat) throw new HttpErrors.NotFound();

    pat.scopes = userPersonalAccessToken.scopes;
    pat.updatedAt = undefined;

    await this.userPersonalAccessTokenRepository.updateById(id, pat);
  }

  @del('/users/{userId}/personal-access-tokens/{id}')
  @response(204, {
    description: 'UserPersonalAccessToken DELETE success',
  })
  async deleteById(
    @param.path.string('userId') userId: string,
    @param.path.string('id') id: string,
  ): Promise<void> {
    if (userId !== this.currentUser[securityId])
      throw new HttpErrors.Unauthorized();

    const pat = await this.userPersonalAccessTokenRepository.findOne({
      where: {
        id: id,
        userId: userId,
      },
    });

    if (!pat) throw new HttpErrors.NotFound();

    await this.userPersonalAccessTokenRepository.deleteById(id);
  }
}
