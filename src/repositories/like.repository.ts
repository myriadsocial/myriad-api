import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, DefaultCrudRepository, repository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Like, LikeRelations, User} from '../models';
import {PostRepository} from './post.repository';
import {UserRepository} from './user.repository';

export class LikeRepository extends DefaultCrudRepository<
  Like,
  typeof Like.prototype.id,
  LikeRelations
> {
  public readonly user: BelongsToAccessor<User, typeof Like.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('PostRepository')
    protected postRepositoryGetter: Getter<PostRepository>,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(Like, dataSource);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}
