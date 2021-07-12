import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Tip, TipRelations, Cryptocurrency} from '../models';
import {CryptocurrencyRepository} from './cryptocurrency.repository';

export class TipRepository extends DefaultCrudRepository<
  Tip,
  typeof Tip.prototype.id,
  TipRelations
> {

  public readonly cryptocurrency: BelongsToAccessor<Cryptocurrency, typeof Tip.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource, @repository.getter('CryptocurrencyRepository') protected cryptocurrencyRepositoryGetter: Getter<CryptocurrencyRepository>,
  ) {
    super(Tip, dataSource);
    this.cryptocurrency = this.createBelongsToAccessorFor('cryptocurrency', cryptocurrencyRepositoryGetter,);
    this.registerInclusionResolver('cryptocurrency', this.cryptocurrency.inclusionResolver);
  }
}
