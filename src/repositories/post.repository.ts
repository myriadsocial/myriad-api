import {Getter, inject} from '@loopback/core';
import {
  BelongsToAccessor,
  DefaultCrudRepository,
  HasManyRepositoryFactory,
  repository,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {
  Comment,
  Like,
  People,
  Post,
  PostRelations,
  Transaction,
  User,
} from '../models';
import {CommentRepository} from './comment.repository';
import {LikeRepository} from './like.repository';
import {PeopleRepository} from './people.repository';
import {TransactionRepository} from './transaction.repository';
import {UserRepository} from './user.repository';

export class PostRepository extends DefaultCrudRepository<
  Post,
  typeof Post.prototype.id,
  PostRelations
> {
  public readonly people: BelongsToAccessor<People, typeof Post.prototype.id>;

  public readonly user: BelongsToAccessor<User, typeof Post.prototype.id>;

  public readonly comments: HasManyRepositoryFactory<
    Comment,
    typeof Post.prototype.id
  >;

  public readonly likes: HasManyRepositoryFactory<
    Like,
    typeof Like.prototype.id
  >;

  public readonly transactions: HasManyRepositoryFactory<
    Transaction,
    typeof Post.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('PeopleRepository')
    protected peopleRepositoryGetter: Getter<PeopleRepository>,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('CommentRepository')
    protected commentRepositoryGetter: Getter<CommentRepository>,
    @repository.getter('TransactionRepository')
    protected transactionRepositoryGetter: Getter<TransactionRepository>,
    @repository.getter('LikeRepository')
    protected likeRepositoryGetter: Getter<LikeRepository>,
  ) {
    super(Post, dataSource);
    this.transactions = this.createHasManyRepositoryFactoryFor(
      'transactions',
      transactionRepositoryGetter,
    );
    this.registerInclusionResolver(
      'transactions',
      this.transactions.inclusionResolver,
    );
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
    this.people = this.createBelongsToAccessorFor(
      'people',
      peopleRepositoryGetter,
    );
    this.registerInclusionResolver('people', this.people.inclusionResolver);
    this.comments = this.createHasManyRepositoryFactoryFor(
      'comments',
      commentRepositoryGetter,
    );
    this.registerInclusionResolver('comments', this.comments.inclusionResolver);
    this.likes = this.createHasManyRepositoryFactoryFor(
      'likes',
      likeRepositoryGetter,
    );
    this.registerInclusionResolver('likes', this.likes.inclusionResolver);
  }
}
