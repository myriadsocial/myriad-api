import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  HttpErrors,
  param,
  patch,
  post,
  requestBody,
  response
} from '@loopback/rest';
import {Token} from '../models';
import {TokenRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class TokenController {
  constructor(
    @repository(TokenRepository)
    public tokenRepository: TokenRepository,
  ) { }

  @post('/tokens')
  @response(200, {
    description: 'Token model instance',
    content: {'application/json': {schema: getModelSchemaRef(Token)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Token, {
            title: 'NewToken',
          }),
        },
      },
    })
    token: Token,
  ): Promise<Token> {
    token.id = token.id.toUpperCase()
    token.token_name = token.token_name.toLowerCase()
    token.rpc_address = token.rpc_address.toLowerCase()

    const foundToken = await this.tokenRepository.findOne({
      where: {
        or: [
          {
            id: token.id
          }
        ]
      }
    })

    if (foundToken) throw new HttpErrors.UnprocessableEntity('Token already exists')

    return this.tokenRepository.create(token);
  }

  @get('/tokens')
  @response(200, {
    description: 'Array of Token model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Token, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Token) filter?: Filter<Token>,
  ): Promise<Token[]> {
    return this.tokenRepository.find(filter);
  }

  @get('/tokens/{id}')
  @response(200, {
    description: 'Token model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Token, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Token, {exclude: 'where'}) filter?: FilterExcludingWhere<Token>
  ): Promise<Token> {
    return this.tokenRepository.findById(id, filter);
  }

  @patch('/tokens/{id}')
  @response(204, {
    description: 'Token PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Token, {partial: true}),
        },
      },
    })
    token: Token,
  ): Promise<void> {
    await this.tokenRepository.updateById(id, token);
  }

  @del('/tokens/{id}')
  @response(204, {
    description: 'Token DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.tokenRepository.deleteById(id);
  }
}
