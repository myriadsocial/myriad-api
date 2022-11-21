import {Getter, inject} from '@loopback/core';
import {
  DefaultCrudRepository,
  HasManyRepositoryFactory,
  repository,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Currency, Network, NetworkRelations} from '../models';
import {CurrencyRepository} from './currency.repository';

export class NetworkRepository extends DefaultCrudRepository<
  Network,
  typeof Network.prototype.id,
  NetworkRelations
> {
  public readonly currencies: HasManyRepositoryFactory<
    Currency,
    typeof Network.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('CurrencyRepository')
    protected currencyRepositoryGetter: Getter<CurrencyRepository>,
  ) {
    super(Network, dataSource);
    this.currencies = this.createHasManyRepositoryFactoryFor(
      'currencies',
      currencyRepositoryGetter,
    );
    this.registerInclusionResolver(
      'currencies',
      this.currencies.inclusionResolver,
    );
  }
}
