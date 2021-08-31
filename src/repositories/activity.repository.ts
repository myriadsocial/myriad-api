import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, DefaultCrudRepository, repository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Activity, ActivityRelations, User} from '../models';
import {UserRepository} from './user.repository';

export class ActivityRepository extends DefaultCrudRepository<
  Activity,
  typeof Activity.prototype.id,
  ActivityRelations
> {
  public readonly user: BelongsToAccessor<User, typeof Activity.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(Activity, dataSource);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}
