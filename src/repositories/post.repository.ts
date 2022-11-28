import {Getter, inject} from '@loopback/core';
import {
  BelongsToAccessor,
  DefaultCrudRepository,
  HasManyRepositoryFactory,
  HasManyThroughRepositoryFactory,
  repository,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {
  Comment,
  Experience,
  ExperiencePost,
  People,
  Post,
  PostRelations,
  Transaction,
  User,
  Vote,
  LockableContent,
} from '../models';
import {CommentRepository} from './comment.repository';
import {ExperiencePostRepository} from './experience-post.repository';
import {ExperienceRepository} from './experience.repository';
import {PeopleRepository} from './people.repository';
import {TransactionRepository} from './transaction.repository';
import {UserRepository} from './user.repository';
import {VoteRepository} from './vote.repository';
import {LockableContentRepository} from './lockable-content.repository';

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

  public readonly votes: HasManyRepositoryFactory<
    Vote,
    typeof Vote.prototype.id
  >;

  public readonly transactions: HasManyRepositoryFactory<
    Transaction,
    typeof Post.prototype.id
  >;

  public readonly experiences: HasManyThroughRepositoryFactory<
    Experience,
    typeof Experience.prototype.id,
    ExperiencePost,
    typeof Post.prototype.id
  >;

  public readonly lockableContents: HasManyRepositoryFactory<
    LockableContent,
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
    @repository.getter('VoteRepository')
    protected voteRepositoryGetter: Getter<VoteRepository>,
    @repository.getter('ExperiencePostRepository')
    protected experiencePostRepositoryGetter: Getter<ExperiencePostRepository>,
    @repository.getter('ExperienceRepository')
    protected experienceRepositoryGetter: Getter<ExperienceRepository>,
    @repository.getter('LockableContentRepository')
    protected lockableContentRepositoryGetter: Getter<LockableContentRepository>,
  ) {
    super(Post, dataSource);
    this.lockableContents = this.createHasManyRepositoryFactoryFor(
      'lockableContents',
      lockableContentRepositoryGetter,
    );
    this.registerInclusionResolver(
      'lockableContents',
      this.lockableContents.inclusionResolver,
    );
    this.experiences = this.createHasManyThroughRepositoryFactoryFor(
      'experiences',
      experienceRepositoryGetter,
      experiencePostRepositoryGetter,
    );
    this.registerInclusionResolver(
      'experiences',
      this.experiences.inclusionResolver,
    );
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
    this.votes = this.createHasManyRepositoryFactoryFor(
      'votes',
      voteRepositoryGetter,
    );
    this.registerInclusionResolver('votes', this.votes.inclusionResolver);
  }
}
