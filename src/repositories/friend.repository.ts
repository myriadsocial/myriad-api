import {Getter, inject} from '@loopback/core';
import {
  BelongsToAccessor,
  DefaultCrudRepository,
  repository,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Friend, FriendRelations, User} from '../models';
import {UserRepository} from './user.repository';

export class FriendRepository extends DefaultCrudRepository<
  Friend,
  typeof Friend.prototype.id,
  FriendRelations
> {
  public readonly requestee: BelongsToAccessor<
    User,
    typeof Friend.prototype.id
  >;

  public readonly requestor: BelongsToAccessor<
    User,
    typeof Friend.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(Friend, dataSource);
    this.requestor = this.createBelongsToAccessorFor(
      'requestor',
      userRepositoryGetter,
    );
    this.registerInclusionResolver(
      'requestor',
      this.requestor.inclusionResolver,
    );
    this.requestee = this.createBelongsToAccessorFor(
      'requestee',
      userRepositoryGetter,
    );
    this.registerInclusionResolver(
      'requestee',
      this.requestee.inclusionResolver,
    );
  }
}
