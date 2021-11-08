import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  BelongsToAccessor,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {
  NotificationSetting,
  NotificationSettingRelations,
  User,
} from '../models';
import {UserRepository} from './user.repository';

export class NotificationSettingRepository extends DefaultCrudRepository<
  NotificationSetting,
  typeof NotificationSetting.prototype.id,
  NotificationSettingRelations
> {
  public readonly user: BelongsToAccessor<
    User,
    typeof NotificationSetting.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(NotificationSetting, dataSource);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}
