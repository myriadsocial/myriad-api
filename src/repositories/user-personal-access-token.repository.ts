import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  BelongsToAccessor,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {
  UserPersonalAccessToken,
  UserPersonalAccessTokenRelations,
  User,
} from '../models';
import {UserRepository} from './user.repository';

export class UserPersonalAccessTokenRepository extends DefaultCrudRepository<
  UserPersonalAccessToken,
  typeof UserPersonalAccessToken.prototype.id,
  UserPersonalAccessTokenRelations
> {
  public readonly user: BelongsToAccessor<
    User,
    typeof UserPersonalAccessToken.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(UserPersonalAccessToken, dataSource);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
  }
}
