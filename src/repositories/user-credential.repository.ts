import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, DefaultCrudRepository, repository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {User, UserCredential, UserCredentialRelations} from '../models';
import {UserRepository} from './user.repository';

export class UserCredentialRepository extends DefaultCrudRepository<
  UserCredential,
  typeof UserCredential.prototype.id,
  UserCredentialRelations
> {

  public readonly user: BelongsToAccessor<User, typeof UserCredential.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(UserCredential, dataSource);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter,);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}
