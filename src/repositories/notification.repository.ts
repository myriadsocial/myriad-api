import {Getter, inject} from '@loopback/core';
import {
  BelongsToAccessor,
  DefaultCrudRepository,
  repository,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Notification, NotificationRelations, User} from '../models';
import {UserRepository} from './user.repository';

export class NotificationRepository extends DefaultCrudRepository<
  Notification,
  typeof Notification.prototype.id,
  NotificationRelations
> {
  public readonly fromUserId: BelongsToAccessor<
    User,
    typeof Notification.prototype.id
  >;

  public readonly toUserId: BelongsToAccessor<
    User,
    typeof Notification.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(Notification, dataSource);
    this.fromUserId = this.createBelongsToAccessorFor(
      'fromUserId',
      userRepositoryGetter,
    );
    this.registerInclusionResolver(
      'fromUserId',
      this.fromUserId.inclusionResolver,
    );
    this.toUserId = this.createBelongsToAccessorFor(
      'toUserId',
      userRepositoryGetter,
    );
    this.registerInclusionResolver('toUserId', this.toUserId.inclusionResolver);
  }
}
