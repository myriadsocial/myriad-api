import {Getter, inject} from '@loopback/core';
import {
  BelongsToAccessor,
  DefaultCrudRepository,
  repository,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Currency, UserCurrency, UserCurrencyRelations} from '../models';
import {CurrencyRepository} from './currency.repository';

export class UserCurrencyRepository extends DefaultCrudRepository<
  UserCurrency,
  typeof UserCurrency.prototype.id,
  UserCurrencyRelations
> {
  public readonly currency: BelongsToAccessor<
    Currency,
    typeof UserCurrency.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter(CurrencyRepository)
    protected currencyRepositoryGetter: Getter<CurrencyRepository>,
  ) {
    super(UserCurrency, dataSource);
    this.currency = this.createBelongsToAccessorFor(
      'currency',
      currencyRepositoryGetter,
    );
    this.registerInclusionResolver('currency', this.currency.inclusionResolver);
  }
}
