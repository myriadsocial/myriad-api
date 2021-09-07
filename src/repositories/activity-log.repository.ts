import {Getter, inject} from '@loopback/core';
import {
  BelongsToAccessor,
  DefaultCrudRepository,
  repository,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {ActivityLog, ActivityLogRelations, User} from '../models';
import {UserRepository} from './user.repository';

export class ActivityLogRepository extends DefaultCrudRepository<
  ActivityLog,
  typeof ActivityLog.prototype.id,
  ActivityLogRelations
> {
  public readonly user: BelongsToAccessor<
    User,
    typeof ActivityLog.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(ActivityLog, dataSource);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}
