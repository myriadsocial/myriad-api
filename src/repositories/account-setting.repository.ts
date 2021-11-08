import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  BelongsToAccessor,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {AccountSetting, AccountSettingRelations, User} from '../models';
import {UserRepository} from './user.repository';

export class AccountSettingRepository extends DefaultCrudRepository<
  AccountSetting,
  typeof AccountSetting.prototype.id,
  AccountSettingRelations
> {
  public readonly user: BelongsToAccessor<
    User,
    typeof AccountSetting.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(AccountSetting, dataSource);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}
