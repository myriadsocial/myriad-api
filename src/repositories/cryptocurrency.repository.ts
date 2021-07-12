import {Getter, inject} from '@loopback/core';
import {
  DefaultCrudRepository,
  HasManyRepositoryFactory,
  repository
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {TransactionHistory, Cryptocurrency, CryptocurrencyRelations, Transaction} from '../models';
import {TransactionHistoryRepository} from './transaction-history.repository';
import {TransactionRepository} from './transaction.repository';

export class CryptocurrencyRepository extends DefaultCrudRepository<
  Cryptocurrency,
  typeof Cryptocurrency.prototype.id,
  CryptocurrencyRelations
> {

  public readonly transactions: HasManyRepositoryFactory<Transaction, typeof Cryptocurrency.prototype.id>;

  public readonly transactionHistories: HasManyRepositoryFactory<TransactionHistory, typeof Cryptocurrency.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('TransactionRepository')
    protected transactionRepositoryGetter: Getter<TransactionRepository>,
    @repository.getter('TransactionHistoryRepository')
    protected transactionHistoryRepositoryGetter: Getter<TransactionHistoryRepository>,
  ) {
    super(Cryptocurrency, dataSource);
    this.transactionHistories = this.createHasManyRepositoryFactoryFor('transactionHistories', transactionHistoryRepositoryGetter,);
    this.registerInclusionResolver('transactionHistories', this.transactionHistories.inclusionResolver);
    this.transactions = this.createHasManyRepositoryFactoryFor('transactions', transactionRepositoryGetter,);
    this.registerInclusionResolver('transactions', this.transactions.inclusionResolver);
  }
}
