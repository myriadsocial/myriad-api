import {
  Count,
  CountSchema,
  Filter,
  repository
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  HttpErrors,
  param,
  post,
  requestBody
} from '@loopback/rest';
import {Token, UserToken} from '../models';
import {
  TokenRepository,
  UserRepository,
  UserTokenRepository
} from '../repositories';
import {authenticate} from '@loopback/authentication';

@authenticate("jwt")
export class UserTokenController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(UserTokenRepository)
    protected userTokenRepository: UserTokenRepository,
    @repository(TokenRepository)
    protected tokenRepository: TokenRepository
  ) { }

  @get('/users/{id}/tokens', {
    responses: {
      '200': {
        description: 'Array of User has many Token through UserToken',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Token)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Token>,
  ): Promise<Token[]> {
    return this.userRepository.tokens(id).find(filter);
  }

  @post('/user-tokens', {
    responses: {
      '200': {
        description: 'create a UserToken model instance',
        content: {'application/json': {schema: getModelSchemaRef(UserToken)}},
      }
    }
  })
  async createToken(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserToken, {
            title: 'NewUserToken'
          })
        }
      }
    }) userToken: UserToken
  ): Promise<UserToken> {
    userToken.tokenId = userToken.tokenId.toUpperCase()

    const foundUserToken = await this.userTokenRepository.findOne({
      where: {
        userId: userToken.userId,
        tokenId: userToken.tokenId
      }
    })

    if (foundUserToken) {
      throw new HttpErrors.UnprocessableEntity('You already have this token')
    }

    const foundToken = await this.tokenRepository.findOne({
      where: {
        id: userToken.tokenId
      }
    })

    if (!foundToken) {
      throw new HttpErrors.NotFound("Token not found. Please add token first!")
    }

    return this.userTokenRepository.create(userToken)
  }

  @del('/users/{userId}/tokens/{tokenId}', {
    responses: {
      '200': {
        description: 'User.Token DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('userId') userId: string,
    @param.path.string('tokenId') tokenId: string,
  ): Promise<Count> {
    return this.userTokenRepository.deleteAll({
      userId: userId,
      tokenId: tokenId.toUpperCase()
    })
  }
}
