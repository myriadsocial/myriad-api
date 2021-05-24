import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  Transaction,
  Token,
} from '../models';
import {TransactionRepository} from '../repositories';

export class TransactionTokenController {
  constructor(
    @repository(TransactionRepository)
    public transactionRepository: TransactionRepository,
  ) { }

  @get('/transactions/{id}/token', {
    responses: {
      '200': {
        description: 'Token belonging to Transaction',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Token)},
          },
        },
      },
    },
  })
  async getToken(
    @param.path.string('id') id: typeof Transaction.prototype.id,
  ): Promise<Token> {
    return this.transactionRepository.token(id);
  }
}
