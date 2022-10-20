import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  BelongsToAccessor,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {UserOtpw, UserOtpwRelations, User} from '../models';
import {UserRepository} from './user.repository';

export class UserOtpwRepository extends DefaultCrudRepository<
  UserOtpw,
  typeof UserOtpw.prototype.id,
  UserOtpwRelations
> {
  public readonly user: BelongsToAccessor<User, typeof UserOtpw.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(UserOtpw, dataSource);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
  }
}
