import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  BelongsToAccessor,
  HasManyRepositoryFactory,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {
  UnlockableContent,
  UnlockableContentRelations,
  User,
  ContentPrice,
} from '../models';
import {UserRepository} from './user.repository';
import {ContentPriceRepository} from './content-price.repository';

export class UnlockableContentRepository extends DefaultCrudRepository<
  UnlockableContent,
  typeof UnlockableContent.prototype.id,
  UnlockableContentRelations
> {
  public readonly user: BelongsToAccessor<
    User,
    typeof UnlockableContent.prototype.id
  >;

  public readonly prices: HasManyRepositoryFactory<
    ContentPrice,
    typeof UnlockableContent.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('ContentPriceRepository')
    protected contentPriceRepositoryGetter: Getter<ContentPriceRepository>,
  ) {
    super(UnlockableContent, dataSource);
    this.prices = this.createHasManyRepositoryFactoryFor(
      'prices',
      contentPriceRepositoryGetter,
    );
    this.registerInclusionResolver('prices', this.prices.inclusionResolver);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}
