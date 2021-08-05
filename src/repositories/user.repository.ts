import {Getter, inject} from '@loopback/core';
import {
  DefaultCrudRepository,
  HasManyThroughRepositoryFactory,
  repository,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Currency, User, UserCurrency, UserRelations} from '../models';
import {CurrencyRepository} from './Currency.repository';
import {UserCurrencyRepository} from './user-currency.repository';

export class UserRepository extends DefaultCrudRepository<
  User,
  typeof User.prototype.id,
  UserRelations
> {
  public readonly currencies: HasManyThroughRepositoryFactory<
    Currency,
    typeof Currency.prototype.id,
    UserCurrency,
    typeof User.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserCurrencyRepository')
    protected userCurrencyRepositoryGetter: Getter<UserCurrencyRepository>,
    @repository.getter('CurrencyRepository')
    protected currencyRepositoryGetter: Getter<CurrencyRepository>,
  ) {
    super(User, dataSource);
    this.currencies = this.createHasManyThroughRepositoryFactoryFor(
      'currencies',
      currencyRepositoryGetter,
      userCurrencyRepositoryGetter,
    );
    this.registerInclusionResolver('currencies', this.currencies.inclusionResolver);
  }
}
