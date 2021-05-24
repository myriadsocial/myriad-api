import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, HasManyRepositoryFactory} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Token, TokenRelations, Transaction, DetailTransaction} from '../models';
import {TransactionRepository} from './transaction.repository';
import {DetailTransactionRepository} from './detail-transaction.repository';

export class TokenRepository extends DefaultCrudRepository<
  Token,
  typeof Token.prototype.id,
  TokenRelations
> {

  public readonly transactions: HasManyRepositoryFactory<Transaction, typeof Token.prototype.id>;

  public readonly detailTransactions: HasManyRepositoryFactory<DetailTransaction, typeof Token.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource, @repository.getter('TransactionRepository') protected transactionRepositoryGetter: Getter<TransactionRepository>, @repository.getter('DetailTransactionRepository') protected detailTransactionRepositoryGetter: Getter<DetailTransactionRepository>,
  ) {
    super(Token, dataSource);
    this.detailTransactions = this.createHasManyRepositoryFactoryFor('detailTransactions', detailTransactionRepositoryGetter,);
    this.registerInclusionResolver('detailTransactions', this.detailTransactions.inclusionResolver);
    this.transactions = this.createHasManyRepositoryFactoryFor('transactions', transactionRepositoryGetter,);
    this.registerInclusionResolver('transactions', this.transactions.inclusionResolver);
  }
}
