import {Getter, inject} from '@loopback/core';
import {
  DefaultCrudRepository,
  HasManyRepositoryFactory,
  HasManyThroughRepositoryFactory,
  repository,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {
  Comment,
  Conversation,
  Cryptocurrency,
  Experience,
  Friend,
  Post,
  TransactionHistory,
  User,
  UserCredential,
  UserCrypto,
  UserExperience,
  UserRelations,
} from '../models';
import {CommentRepository} from './comment.repository';
import {ConversationRepository} from './conversation.repository';
import {CryptocurrencyRepository} from './cryptocurrency.repository';
import {ExperienceRepository} from './experience.repository';
import {FriendRepository} from './friend.repository';
import {PostRepository} from './post.repository';
import {TransactionHistoryRepository} from './transaction-history.repository';
import {UserCredentialRepository} from './user-credential.repository';
import {UserCryptoRepository} from './user-crypto.repository';
import {UserExperienceRepository} from './user-experience.repository';

export class UserRepository extends DefaultCrudRepository<
  User,
  typeof User.prototype.id,
  UserRelations
> {
  public readonly experiences: HasManyRepositoryFactory<Experience, typeof User.prototype.id>;

  public readonly comments: HasManyRepositoryFactory<Comment, typeof User.prototype.id>;

  public readonly userExperiences: HasManyThroughRepositoryFactory<
    Experience,
    typeof Experience.prototype.id,
    UserExperience,
    typeof User.prototype.id
  >;

  public readonly userCredentials: HasManyRepositoryFactory<
    UserCredential,
    typeof User.prototype.id
  >;

  public readonly posts: HasManyRepositoryFactory<Post, typeof User.prototype.id>;

  public readonly conversations: HasManyRepositoryFactory<Conversation, typeof User.prototype.id>;

  public readonly friends: HasManyThroughRepositoryFactory<
    User,
    typeof User.prototype.id,
    Friend,
    typeof User.prototype.id
  >;

  public readonly transactionHistories: HasManyRepositoryFactory<
    TransactionHistory,
    typeof User.prototype.id
  >;

  public readonly cryptocurrencies: HasManyThroughRepositoryFactory<
    Cryptocurrency,
    typeof Cryptocurrency.prototype.id,
    UserCrypto,
    typeof User.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('ExperienceRepository')
    protected experienceRepositoryGetter: Getter<ExperienceRepository>,
    @repository.getter('CommentRepository')
    protected commentRepositoryGetter: Getter<CommentRepository>,
    @repository.getter('UserExperienceRepository')
    protected userExperienceRepositoryGetter: Getter<UserExperienceRepository>,
    @repository.getter('UserCredentialRepository')
    protected userCredentialRepositoryGetter: Getter<UserCredentialRepository>,
    @repository.getter('PostRepository')
    protected postRepositoryGetter: Getter<PostRepository>,
    @repository.getter('ConversationRepository')
    protected conversationRepositoryGetter: Getter<ConversationRepository>,
    @repository.getter('FriendRepository')
    protected friendRepositoryGetter: Getter<FriendRepository>,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('TransactionHistoryRepository')
    protected transactionHistoryRepositoryGetter: Getter<TransactionHistoryRepository>,
    @repository.getter('UserCryptoRepository')
    protected userCryptoRepositoryGetter: Getter<UserCryptoRepository>,
    @repository.getter('CryptocurrencyRepository')
    protected cryptocurrencyRepositoryGetter: Getter<CryptocurrencyRepository>,
  ) {
    super(User, dataSource);
    this.cryptocurrencies = this.createHasManyThroughRepositoryFactoryFor(
      'cryptocurrencies',
      cryptocurrencyRepositoryGetter,
      userCryptoRepositoryGetter,
    );
    this.registerInclusionResolver('cryptocurrencies', this.cryptocurrencies.inclusionResolver);
    this.transactionHistories = this.createHasManyRepositoryFactoryFor(
      'transactionHistories',
      transactionHistoryRepositoryGetter,
    );
    this.registerInclusionResolver(
      'transactionHistories',
      this.transactionHistories.inclusionResolver,
    );
    this.friends = this.createHasManyThroughRepositoryFactoryFor(
      'friends',
      Getter.fromValue(this),
      friendRepositoryGetter,
    );
    this.registerInclusionResolver('friends', this.friends.inclusionResolver);
    this.conversations = this.createHasManyRepositoryFactoryFor(
      'conversations',
      conversationRepositoryGetter,
    );
    this.registerInclusionResolver('conversations', this.conversations.inclusionResolver);
    this.posts = this.createHasManyRepositoryFactoryFor('posts', postRepositoryGetter);
    this.registerInclusionResolver('posts', this.posts.inclusionResolver);
    this.userCredentials = this.createHasManyRepositoryFactoryFor(
      'credentials',
      userCredentialRepositoryGetter,
    );
    this.registerInclusionResolver('credentials', this.userCredentials.inclusionResolver);
    this.userExperiences = this.createHasManyThroughRepositoryFactoryFor(
      'userExperiences',
      experienceRepositoryGetter,
      userExperienceRepositoryGetter,
    );
    this.registerInclusionResolver('userExperiences', this.userExperiences.inclusionResolver);
    this.comments = this.createHasManyRepositoryFactoryFor('comments', commentRepositoryGetter);
    this.registerInclusionResolver('comments', this.comments.inclusionResolver);
    this.experiences = this.createHasManyRepositoryFactoryFor(
      'experiences',
      experienceRepositoryGetter,
    );
    this.registerInclusionResolver('experiences', this.experiences.inclusionResolver);
  }
}
