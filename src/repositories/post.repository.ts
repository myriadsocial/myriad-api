import {Getter, inject} from '@loopback/core';
import {
  BelongsToAccessor,
  DefaultCrudRepository,
  HasManyRepositoryFactory,
  HasOneRepositoryFactory,
  repository
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {
  Comment,
  Dislike,
  Like,
  People,
  Post,
  PostRelations,
  PublicMetric,
  User, Transaction} from '../models';
import {CommentRepository} from './comment.repository';
import {DislikeRepository} from './dislike.repository';
import {LikeRepository} from './like.repository';
import {PeopleRepository} from './people.repository';
import {PublicMetricRepository} from './public-metric.repository';
import {UserRepository} from './user.repository';
import {TransactionRepository} from './transaction.repository';

export class PostRepository extends DefaultCrudRepository<
  Post,
  typeof Post.prototype.id,
  PostRelations
> {

  public readonly comments: HasManyRepositoryFactory<Comment, typeof Post.prototype.id>;

  public readonly people: BelongsToAccessor<People, typeof Post.prototype.id>;

  public readonly user: BelongsToAccessor<User, typeof Post.prototype.id>;

  public readonly likes: HasManyRepositoryFactory<Like, typeof Post.prototype.id>;

  public readonly publicMetric: HasOneRepositoryFactory<PublicMetric, typeof Post.prototype.id>;

  public readonly dislikes: HasManyRepositoryFactory<Dislike, typeof Post.prototype.id>;

  public readonly transactions: HasManyRepositoryFactory<Transaction, typeof Post.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('CommentRepository')
    protected commentRepositoryGetter: Getter<CommentRepository>,
    @repository.getter('PeopleRepository')
    protected peopleRepositoryGetter: Getter<PeopleRepository>,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('LikeRepository')
    protected likeRepositoryGetter: Getter<LikeRepository>,
    @repository.getter('PublicMetricRepository')
    protected publicMetricRepositoryGetter: Getter<PublicMetricRepository>,
    @repository.getter('DislikeRepository')
    protected dislikeRepositoryGetter: Getter<DislikeRepository>, 
    @repository.getter('TransactionRepository') 
    protected transactionRepositoryGetter: Getter<TransactionRepository>,
  ) {
    super(Post, dataSource);
    this.transactions = this.createHasManyRepositoryFactoryFor('transactions', transactionRepositoryGetter,);
    this.registerInclusionResolver('transactions', this.transactions.inclusionResolver);
    this.dislikes = this.createHasManyRepositoryFactoryFor('dislikes', dislikeRepositoryGetter,);
    this.registerInclusionResolver('dislikes', this.dislikes.inclusionResolver);
    this.publicMetric = this.createHasOneRepositoryFactoryFor('publicMetric', publicMetricRepositoryGetter);
    this.registerInclusionResolver('publicMetric', this.publicMetric.inclusionResolver);
    this.likes = this.createHasManyRepositoryFactoryFor('likes', likeRepositoryGetter,);
    this.registerInclusionResolver('likes', this.likes.inclusionResolver);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter,);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
    this.people = this.createBelongsToAccessorFor('people', peopleRepositoryGetter,);
    this.registerInclusionResolver('people', this.people.inclusionResolver);
    this.comments = this.createHasManyRepositoryFactoryFor('comments', commentRepositoryGetter,);
    this.registerInclusionResolver('comments', this.comments.inclusionResolver);
  }
}
