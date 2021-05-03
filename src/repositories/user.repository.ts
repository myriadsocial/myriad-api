import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, HasManyRepositoryFactory, HasManyThroughRepositoryFactory} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {User, UserRelations, Experience, Comment, SavedExperience, UserCredential, Post, Like, Conversation} from '../models';
import {ExperienceRepository} from './experience.repository';
import {CommentRepository} from './comment.repository';
import {SavedExperienceRepository} from './saved-experience.repository';
import {UserCredentialRepository} from './user-credential.repository';
import {PostRepository} from './post.repository';
import {LikeRepository} from './like.repository';
import {ConversationRepository} from './conversation.repository';

export class UserRepository extends DefaultCrudRepository<
  User,
  typeof User.prototype.id,
  UserRelations
> {

  public readonly experiences: HasManyRepositoryFactory<Experience, typeof User.prototype.id>;

  public readonly comments: HasManyRepositoryFactory<Comment, typeof User.prototype.id>;

  public readonly savedExperiences: HasManyThroughRepositoryFactory<Experience, typeof Experience.prototype.id,
          SavedExperience,
          typeof User.prototype.id
        >;

  public readonly userCredentials: HasManyRepositoryFactory<UserCredential, typeof User.prototype.id>;

  public readonly posts: HasManyRepositoryFactory<Post, typeof User.prototype.id>;

  public readonly likes: HasManyRepositoryFactory<Like, typeof User.prototype.id>;

  public readonly conversations: HasManyRepositoryFactory<Conversation, typeof User.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource, @repository.getter('ExperienceRepository') protected experienceRepositoryGetter: Getter<ExperienceRepository>, @repository.getter('CommentRepository') protected commentRepositoryGetter: Getter<CommentRepository>, @repository.getter('SavedExperienceRepository') protected savedExperienceRepositoryGetter: Getter<SavedExperienceRepository>, @repository.getter('UserCredentialRepository') protected userCredentialRepositoryGetter: Getter<UserCredentialRepository>, @repository.getter('PostRepository') protected postRepositoryGetter: Getter<PostRepository>, @repository.getter('LikeRepository') protected likeRepositoryGetter: Getter<LikeRepository>, @repository.getter('ConversationRepository') protected conversationRepositoryGetter: Getter<ConversationRepository>,
  ) {
    super(User, dataSource);
    this.conversations = this.createHasManyRepositoryFactoryFor('conversations', conversationRepositoryGetter,);
    this.registerInclusionResolver('conversations', this.conversations.inclusionResolver);
    this.likes = this.createHasManyRepositoryFactoryFor('likes', likeRepositoryGetter,);
    this.registerInclusionResolver('likes', this.likes.inclusionResolver);
    this.posts = this.createHasManyRepositoryFactoryFor('posts', postRepositoryGetter,);
    this.registerInclusionResolver('posts', this.posts.inclusionResolver);
    this.userCredentials = this.createHasManyRepositoryFactoryFor('userCredentials', userCredentialRepositoryGetter,);
    this.registerInclusionResolver('userCredentials', this.userCredentials.inclusionResolver);
    this.savedExperiences = this.createHasManyThroughRepositoryFactoryFor('savedExperiences', experienceRepositoryGetter, savedExperienceRepositoryGetter,);
    this.registerInclusionResolver('savedExperiences', this.savedExperiences.inclusionResolver);
    this.comments = this.createHasManyRepositoryFactoryFor('comments', commentRepositoryGetter,);
    this.registerInclusionResolver('comments', this.comments.inclusionResolver);
    this.experiences = this.createHasManyRepositoryFactoryFor('experiences', experienceRepositoryGetter,);
    this.registerInclusionResolver('experiences', this.experiences.inclusionResolver);
  }
}
