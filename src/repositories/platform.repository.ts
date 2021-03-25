import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, DefaultCrudRepository, repository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Platform, PlatformRelations, User} from '../models';
import {UserRepository} from './user.repository';

export class PlatformRepository extends DefaultCrudRepository<
  Platform,
  typeof Platform.prototype.id,
  PlatformRelations
> {

  public readonly user: BelongsToAccessor<User, typeof Platform.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(Platform, dataSource);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter,);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}
