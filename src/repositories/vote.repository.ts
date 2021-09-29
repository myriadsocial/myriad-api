import {Getter, inject} from '@loopback/core';
import {
  BelongsToAccessor,
  DefaultCrudRepository,
  repository,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Vote, VoteRelations, User} from '../models';
import {PostRepository} from './post.repository';
import {UserRepository} from './user.repository';

export class VoteRepository extends DefaultCrudRepository<
  Vote,
  typeof Vote.prototype.id,
  VoteRelations
> {
  public readonly user: BelongsToAccessor<User, typeof Vote.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('PostRepository')
    protected postRepositoryGetter: Getter<PostRepository>,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(Vote, dataSource);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}
