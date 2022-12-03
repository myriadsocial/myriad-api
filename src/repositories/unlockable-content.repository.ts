import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  BelongsToAccessor,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {UnlockableContent, UnlockableContentRelations, User} from '../models';
import {UserRepository} from './user.repository';

export class UnlockableContentRepository extends DefaultCrudRepository<
  UnlockableContent,
  typeof UnlockableContent.prototype.id,
  UnlockableContentRelations
> {
  public readonly user: BelongsToAccessor<
    User,
    typeof UnlockableContent.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(UnlockableContent, dataSource);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}
