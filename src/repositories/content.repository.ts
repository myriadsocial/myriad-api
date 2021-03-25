import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, DefaultCrudRepository, HasManyRepositoryFactory, repository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Comment, Content, ContentRelations, User} from '../models';
import {CommentRepository} from './comment.repository';
import {UserRepository} from './user.repository';

export class ContentRepository extends DefaultCrudRepository<
  Content,
  typeof Content.prototype.id,
  ContentRelations
> {

  public readonly user: BelongsToAccessor<User, typeof Content.prototype.id>;

  public readonly comments: HasManyRepositoryFactory<Comment, typeof Content.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('CommentRepository')
    protected commentRepositoryGetter: Getter<CommentRepository>,
  ) {
    super(Content, dataSource);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter,);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
    this.comments = this.createHasManyRepositoryFactoryFor('comments', commentRepositoryGetter,);
    this.registerInclusionResolver('comments', this.comments.inclusionResolver);
  }
}
