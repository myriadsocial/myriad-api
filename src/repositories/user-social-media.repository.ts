import {Getter, inject} from '@loopback/core';
import {
  BelongsToAccessor,
  DefaultCrudRepository,
  repository,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {
  People,
  User,
  UserSocialMedia,
  UserSocialMediaRelations,
} from '../models';
import {PeopleRepository} from './people.repository';
import {UserRepository} from './user.repository';

export class UserSocialMediaRepository extends DefaultCrudRepository<
  UserSocialMedia,
  typeof UserSocialMedia.prototype.id,
  UserSocialMediaRelations
> {
  public readonly user: BelongsToAccessor<
    User,
    typeof UserSocialMedia.prototype.id
  >;

  public readonly people: BelongsToAccessor<
    People,
    typeof UserSocialMedia.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('PeopleRepository')
    protected peopleRepositoryGetter: Getter<PeopleRepository>,
  ) {
    super(UserSocialMedia, dataSource);
    this.people = this.createBelongsToAccessorFor(
      'people',
      peopleRepositoryGetter,
    );
    this.registerInclusionResolver('people', this.people.inclusionResolver);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}
