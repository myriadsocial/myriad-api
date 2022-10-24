import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  BelongsToAccessor,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {UserOTP, UserOTPRelations, User} from '../models';
import {UserRepository} from './user.repository';

export class UserOTPRepository extends DefaultCrudRepository<
  UserOTP,
  typeof UserOTP.prototype.id,
  UserOTPRelations
> {
  public readonly user: BelongsToAccessor<User, typeof UserOTP.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(UserOTP, dataSource);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
  }
}
