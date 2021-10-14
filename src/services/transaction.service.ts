import {repository} from '@loopback/repository';
import {Transaction} from '../models';
import {TransactionRepository} from '../repositories';
import {injectable, BindingScope} from '@loopback/core';

/* eslint-disable  @typescript-eslint/no-explicit-any */
@injectable({scope: BindingScope.TRANSIENT})
export class TransactionService {
  constructor(
    @repository(TransactionRepository)
    protected transactionRepository: TransactionRepository,
  ) {}

  // ignore
  async totalTransactionAmount(field: string, id: string, groupBy: string) {
    const collections = (
      this.transactionRepository.dataSource.connector as any
    ).collection(Transaction.modelName);

    return collections
      .aggregate([
        {$match: {[field]: {$in: [id]}}},
        {$group: {_id: groupBy, amount: {$sum: '$amount'}}},
        {$project: {_id: 0, currencyId: '$_id', amount: '$amount'}},
      ])
      .get();
  }
}
