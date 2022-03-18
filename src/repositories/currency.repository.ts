import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  BelongsToAccessor,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Currency, CurrencyRelations, Network} from '../models';
import {NetworkRepository} from './network.repository';

export class CurrencyRepository extends DefaultCrudRepository<
  Currency,
  typeof Currency.prototype.id,
  CurrencyRelations
> {
  public readonly network: BelongsToAccessor<
    Network,
    typeof Currency.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('NetworkRepository')
    protected networkRepositoryGetter: Getter<NetworkRepository>,
  ) {
    super(Currency, dataSource);
    this.network = this.createBelongsToAccessorFor(
      'network',
      networkRepositoryGetter,
    );
    this.registerInclusionResolver('network', this.network.inclusionResolver);
  }
}
