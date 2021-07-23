import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, DefaultCrudRepository, repository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {People, User, UserCredential, UserCredentialRelations} from '../models';
import {PeopleRepository} from './people.repository';
import {UserRepository} from './user.repository';

export class UserCredentialRepository extends DefaultCrudRepository<
  UserCredential,
  typeof UserCredential.prototype.id,
  UserCredentialRelations
> {
  public readonly user: BelongsToAccessor<User, typeof UserCredential.prototype.id>;

  public readonly people: BelongsToAccessor<People, typeof UserCredential.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('PeopleRepository')
    protected peopleRepositoryGetter: Getter<PeopleRepository>,
  ) {
    super(UserCredential, dataSource);
    this.people = this.createBelongsToAccessorFor('people', peopleRepositoryGetter);
    this.registerInclusionResolver('people', this.people.inclusionResolver);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}
