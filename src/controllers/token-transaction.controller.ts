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
  Transaction,
} from '../models';
import {TokenRepository} from '../repositories';

export class TokenTransactionController {
  constructor(
    @repository(TokenRepository) protected tokenRepository: TokenRepository,
  ) { }

  // @get('/tokens/{id}/transactions', {
  //   responses: {
  //     '200': {
  //       description: 'Array of Token has many Transaction',
  //       content: {
  //         'application/json': {
  //           schema: {type: 'array', items: getModelSchemaRef(Transaction)},
  //         },
  //       },
  //     },
  //   },
  // })
  // async find(
  //   @param.path.string('id') id: string,
  //   @param.query.object('filter') filter?: Filter<Transaction>,
  // ): Promise<Transaction[]> {
  //   return this.tokenRepository.transactions(id).find(filter);
  // }

  // @post('/tokens/{id}/transactions', {
  //   responses: {
  //     '200': {
  //       description: 'Token model instance',
  //       content: {'application/json': {schema: getModelSchemaRef(Transaction)}},
  //     },
  //   },
  // })
  // async create(
  //   @param.path.string('id') id: typeof Token.prototype.id,
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(Transaction, {
  //           title: 'NewTransactionInToken',
  //           exclude: ['id'],
  //           optional: ['tokenId']
  //         }),
  //       },
  //     },
  //   }) transaction: Omit<Transaction, 'id'>,
  // ): Promise<Transaction> {
  //   return this.tokenRepository.transactions(id).create(transaction);
  // }

  // @patch('/tokens/{id}/transactions', {
  //   responses: {
  //     '200': {
  //       description: 'Token.Transaction PATCH success count',
  //       content: {'application/json': {schema: CountSchema}},
  //     },
  //   },
  // })
  // async patch(
  //   @param.path.string('id') id: string,
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(Transaction, {partial: true}),
  //       },
  //     },
  //   })
  //   transaction: Partial<Transaction>,
  //   @param.query.object('where', getWhereSchemaFor(Transaction)) where?: Where<Transaction>,
  // ): Promise<Count> {
  //   return this.tokenRepository.transactions(id).patch(transaction, where);
  // }

  // @del('/tokens/{id}/transactions', {
  //   responses: {
  //     '200': {
  //       description: 'Token.Transaction DELETE success count',
  //       content: {'application/json': {schema: CountSchema}},
  //     },
  //   },
  // })
  // async delete(
  //   @param.path.string('id') id: string,
  //   @param.query.object('where', getWhereSchemaFor(Transaction)) where?: Where<Transaction>,
  // ): Promise<Count> {
  //   return this.tokenRepository.transactions(id).delete(where);
  // }
}
