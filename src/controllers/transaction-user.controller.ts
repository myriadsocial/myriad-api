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
  User,
} from '../models';
import {TransactionRepository} from '../repositories';

export class TransactionUserController {
  constructor(
    @repository(TransactionRepository)
    public transactionRepository: TransactionRepository,
  ) { }

  @get('/transactions/{id}/user', {
    responses: {
      '200': {
        description: 'User belonging to Transaction',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(User)},
          },
        },
      },
    },
  })
  async getUser(
    @param.path.string('id') id: typeof Transaction.prototype.id,
  ): Promise<User> {
    return this.transactionRepository.toUser(id);
  }
}
