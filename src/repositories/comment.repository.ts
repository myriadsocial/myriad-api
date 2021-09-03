import {Getter, inject} from '@loopback/core';
import {
  BelongsToAccessor,
  DefaultCrudRepository,
  HasManyRepositoryFactory,
  HasManyThroughRepositoryFactory,
  repository,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Comment, CommentLink, CommentRelations, Post, Transaction, User} from '../models';
import {CommentLinkRepository} from './comment-link.repository';
import {PostRepository} from './post.repository';
import {TransactionRepository} from './transaction.repository';
import {UserRepository} from './user.repository';

export class CommentRepository extends DefaultCrudRepository<
  Comment,
  typeof Comment.prototype.id,
  CommentRelations
> {
  public readonly post: BelongsToAccessor<Post, typeof Comment.prototype.id>;

  public readonly user: BelongsToAccessor<User, typeof Comment.prototype.id>;

  public readonly transactions: HasManyRepositoryFactory<Transaction, typeof Comment.prototype.id>;

  public readonly comments: HasManyThroughRepositoryFactory<
    Comment,
    typeof Comment.prototype.id,
    CommentLink,
    typeof Comment.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('PostRepository')
    protected postRepositoryGetter: Getter<PostRepository>,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('TransactionRepository')
    protected transactionRepositoryGetter: Getter<TransactionRepository>,
    @repository.getter('CommentLinkRepository')
    protected commentLinkRepositoryGetter: Getter<CommentLinkRepository>,
  ) {
    super(Comment, dataSource);
    this.comments = this.createHasManyThroughRepositoryFactoryFor(
      'comments',
      Getter.fromValue(this),
      commentLinkRepositoryGetter,
    );
    this.registerInclusionResolver('comments', this.comments.inclusionResolver);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
    this.post = this.createBelongsToAccessorFor('post', postRepositoryGetter);
    this.registerInclusionResolver('post', this.post.inclusionResolver);
    this.transactions = this.createHasManyRepositoryFactoryFor(
      'transactions',
      transactionRepositoryGetter,
    );
    this.registerInclusionResolver('transactions', this.transactions.inclusionResolver);
  }
}
