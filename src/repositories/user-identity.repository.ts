import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, DefaultCrudRepository, repository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {User, UserIdentity, UserIdentityRelations} from '../models';
import {UserRepository} from './user.repository';

export class UserIdentityRepository extends DefaultCrudRepository<
  UserIdentity,
  typeof UserIdentity.prototype.id,
  UserIdentityRelations
> {

  public readonly user: BelongsToAccessor<User, typeof UserIdentity.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(UserIdentity, dataSource);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter,);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}
