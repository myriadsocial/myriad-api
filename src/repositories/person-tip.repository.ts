import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  BelongsToAccessor,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {PersonTip, PersonTipRelations, Cryptocurrency} from '../models';
import {CryptocurrencyRepository} from './cryptocurrency.repository';

export class PersonTipRepository extends DefaultCrudRepository<
  PersonTip,
  typeof PersonTip.prototype.id,
  PersonTipRelations
> {
  public readonly cryptocurrency: BelongsToAccessor<
    Cryptocurrency,
    typeof PersonTip.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('CryptocurrencyRepository')
    protected cryptocurrencyRepositoryGetter: Getter<CryptocurrencyRepository>,
  ) {
    super(PersonTip, dataSource);
    this.cryptocurrency = this.createBelongsToAccessorFor(
      'cryptocurrency',
      cryptocurrencyRepositoryGetter,
    );
    this.registerInclusionResolver(
      'cryptocurrency',
      this.cryptocurrency.inclusionResolver,
    );
  }
}
