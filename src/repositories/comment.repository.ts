import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, DefaultCrudRepository, repository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Comment, CommentRelations, Content, User} from '../models';
import {ContentRepository} from './content.repository';
import {UserRepository} from './user.repository';

export class CommentRepository extends DefaultCrudRepository<
  Comment,
  typeof Comment.prototype.id,
  CommentRelations
> {

  public readonly user: BelongsToAccessor<User, typeof Comment.prototype.id>;

  public readonly content: BelongsToAccessor<Content, typeof Comment.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('ContentRepository')
    protected contentRepositoryGetter: Getter<ContentRepository>,
  ) {
    super(Comment, dataSource);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter,);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
    this.content = this.createBelongsToAccessorFor('content', contentRepositoryGetter,);
    this.registerInclusionResolver('content', this.content.inclusionResolver);
  }
}
