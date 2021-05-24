import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import {
  Token,
  DetailTransaction,
} from '../models';
import {TokenRepository} from '../repositories';

export class TokenDetailTransactionController {
  constructor(
    @repository(TokenRepository) protected tokenRepository: TokenRepository,
  ) { }

  @get('/tokens/{id}/detail-transactions', {
    responses: {
      '200': {
        description: 'Array of Token has many DetailTransaction',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(DetailTransaction)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<DetailTransaction>,
  ): Promise<DetailTransaction[]> {
    return this.tokenRepository.detailTransactions(id).find(filter);
  }

  @post('/tokens/{id}/detail-transactions', {
    responses: {
      '200': {
        description: 'Token model instance',
        content: {'application/json': {schema: getModelSchemaRef(DetailTransaction)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Token.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(DetailTransaction, {
            title: 'NewDetailTransactionInToken',
            exclude: ['id'],
            optional: ['tokenId']
          }),
        },
      },
    }) detailTransaction: Omit<DetailTransaction, 'id'>,
  ): Promise<DetailTransaction> {
    return this.tokenRepository.detailTransactions(id).create(detailTransaction);
  }

  @patch('/tokens/{id}/detail-transactions', {
    responses: {
      '200': {
        description: 'Token.DetailTransaction PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(DetailTransaction, {partial: true}),
        },
      },
    })
    detailTransaction: Partial<DetailTransaction>,
    @param.query.object('where', getWhereSchemaFor(DetailTransaction)) where?: Where<DetailTransaction>,
  ): Promise<Count> {
    return this.tokenRepository.detailTransactions(id).patch(detailTransaction, where);
  }

  @del('/tokens/{id}/detail-transactions', {
    responses: {
      '200': {
        description: 'Token.DetailTransaction DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(DetailTransaction)) where?: Where<DetailTransaction>,
  ): Promise<Count> {
    return this.tokenRepository.detailTransactions(id).delete(where);
  }
}
