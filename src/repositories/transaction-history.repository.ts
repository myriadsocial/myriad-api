import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {TransactionHistory, TransactionHistoryRelations, User, Cryptocurrency} from '../models';
import {UserRepository} from './user.repository';
import {CryptocurrencyRepository} from './cryptocurrency.repository';

export class TransactionHistoryRepository extends DefaultCrudRepository<
  TransactionHistory,
  typeof TransactionHistory.prototype.id,
  TransactionHistoryRelations
> {
  public readonly user: BelongsToAccessor<User, typeof TransactionHistory.prototype.id>;

  public readonly cryptocurrency: BelongsToAccessor<
    Cryptocurrency,
    typeof TransactionHistory.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('CryptocurrencyRepository')
    protected cryptocurrencyRepositoryGetter: Getter<CryptocurrencyRepository>,
  ) {
    super(TransactionHistory, dataSource);
    this.cryptocurrency = this.createBelongsToAccessorFor(
      'cryptocurrency',
      cryptocurrencyRepositoryGetter,
    );
    this.registerInclusionResolver('cryptocurrency', this.cryptocurrency.inclusionResolver);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}
