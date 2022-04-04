import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  BelongsToAccessor,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {
  UserCurrency,
  UserCurrencyRelations,
  User,
  Currency,
  Network,
} from '../models';
import {UserRepository} from './user.repository';
import {CurrencyRepository} from './currency.repository';
import {NetworkRepository} from './network.repository';

export class UserCurrencyRepository extends DefaultCrudRepository<
  UserCurrency,
  typeof UserCurrency.prototype.id,
  UserCurrencyRelations
> {
  public readonly user: BelongsToAccessor<
    User,
    typeof UserCurrency.prototype.id
  >;

  public readonly currency: BelongsToAccessor<
    Currency,
    typeof UserCurrency.prototype.id
  >;

  public readonly network: BelongsToAccessor<
    Network,
    typeof UserCurrency.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('CurrencyRepository')
    protected currencyRepositoryGetter: Getter<CurrencyRepository>,
    @repository.getter('NetworkRepository')
    protected networkRepositoryGetter: Getter<NetworkRepository>,
  ) {
    super(UserCurrency, dataSource);
    this.network = this.createBelongsToAccessorFor(
      'network',
      networkRepositoryGetter,
    );
    this.registerInclusionResolver('network', this.network.inclusionResolver);
    this.currency = this.createBelongsToAccessorFor(
      'currency',
      currencyRepositoryGetter,
    );
    this.registerInclusionResolver('currency', this.currency.inclusionResolver);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}
