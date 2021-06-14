import {Getter, inject} from '@loopback/core';
import {
  BelongsToAccessor,
  DefaultCrudRepository,
  repository
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Dislike, DislikeRelations, Post, User} from '../models';
import {PostRepository} from './post.repository';
import {UserRepository} from './user.repository';

export class DislikeRepository extends DefaultCrudRepository<
  Dislike,
  typeof Dislike.prototype.id,
  DislikeRelations
> {

  public readonly user: BelongsToAccessor<User, typeof Dislike.prototype.id>;

  public readonly post: BelongsToAccessor<Post, typeof Dislike.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('PostRepository')
    protected postRepositoryGetter: Getter<PostRepository>,
  ) {
    super(Dislike, dataSource);
    this.post = this.createBelongsToAccessorFor('post', postRepositoryGetter,);
    this.registerInclusionResolver('post', this.post.inclusionResolver);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter,);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}
