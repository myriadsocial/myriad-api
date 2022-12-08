import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  BelongsToAccessor,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {
  ContentPrice,
  ContentPriceRelations,
  Currency,
  UnlockableContent,
} from '../models';
import {CurrencyRepository} from './currency.repository';
import {UnlockableContentRepository} from './unlockable-content.repository';

export class ContentPriceRepository extends DefaultCrudRepository<
  ContentPrice,
  typeof ContentPrice.prototype.id,
  ContentPriceRelations
> {
  public readonly currency: BelongsToAccessor<
    Currency,
    typeof ContentPrice.prototype.id
  >;

  public readonly unlockableContent: BelongsToAccessor<
    UnlockableContent,
    typeof ContentPrice.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('CurrencyRepository')
    protected currencyRepositoryGetter: Getter<CurrencyRepository>,
    @repository.getter('UnlockableContentRepository')
    protected unlockableContentRepositoryGetter: Getter<UnlockableContentRepository>,
  ) {
    super(ContentPrice, dataSource);
    this.unlockableContent = this.createBelongsToAccessorFor(
      'unlockableContent',
      unlockableContentRepositoryGetter,
    );
    this.registerInclusionResolver(
      'unlockableContent',
      this.unlockableContent.inclusionResolver,
    );
    this.currency = this.createBelongsToAccessorFor(
      'currency',
      currencyRepositoryGetter,
    );
    this.registerInclusionResolver('currency', this.currency.inclusionResolver);
  }
}
