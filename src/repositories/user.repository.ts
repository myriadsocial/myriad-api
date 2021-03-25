import {Getter, inject} from '@loopback/core';
import {DefaultCrudRepository, HasManyRepositoryFactory, repository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Comment, Content, Experience, Platform, Topic, User, UserCredential, UserIdentity, UserRelations} from '../models';
import {CommentRepository} from './comment.repository';
import {ContentRepository} from './content.repository';
import {ExperienceRepository} from './experience.repository';
import {PlatformRepository} from './platform.repository';
import {TopicRepository} from './topic.repository';
import {UserCredentialRepository} from './user-credential.repository';
import {UserIdentityRepository} from './user-identity.repository';

export class UserRepository extends DefaultCrudRepository<
  User,
  typeof User.prototype.id,
  UserRelations
> {

  public readonly userCredentials: HasManyRepositoryFactory<UserCredential, typeof User.prototype.id>;

  public readonly userIdentities: HasManyRepositoryFactory<UserIdentity, typeof User.prototype.id>;

  public readonly topics: HasManyRepositoryFactory<Topic, typeof User.prototype.id>;

  public readonly platforms: HasManyRepositoryFactory<Platform, typeof User.prototype.id>;

  public readonly contents: HasManyRepositoryFactory<Content, typeof User.prototype.id>;

  public readonly comments: HasManyRepositoryFactory<Comment, typeof User.prototype.id>;

  public readonly experiences: HasManyRepositoryFactory<Experience, typeof User.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserCredentialRepository')
    protected userCredentialRepositoryGetter: Getter<UserCredentialRepository>,
    @repository.getter('UserIdentityRepository')
    protected userIdentityRepositoryGetter: Getter<UserIdentityRepository>,
    @repository.getter('TopicRepository')
    protected topicRepositoryGetter: Getter<TopicRepository>,
    @repository.getter('PlatformRepository')
    protected platformRepositoryGetter: Getter<PlatformRepository>,
    @repository.getter('ContentRepository')
    protected contentRepositoryGetter: Getter<ContentRepository>,
    @repository.getter('CommentRepository')
    protected commentRepositoryGetter: Getter<CommentRepository>,
    @repository.getter('ExperienceRepository')
    protected experienceRepositoryGetter: Getter<ExperienceRepository>,
  ) {
    super(User, dataSource);
    this.userCredentials = this.createHasManyRepositoryFactoryFor('userCredentials', userCredentialRepositoryGetter,);
    this.registerInclusionResolver('userCredentials', this.userCredentials.inclusionResolver);
    this.userIdentities = this.createHasManyRepositoryFactoryFor('userIdentities', userIdentityRepositoryGetter,);
    this.registerInclusionResolver('userIdentities', this.userIdentities.inclusionResolver);
    this.topics = this.createHasManyRepositoryFactoryFor('topics', topicRepositoryGetter,);
    this.registerInclusionResolver('topics', this.topics.inclusionResolver);
    this.platforms = this.createHasManyRepositoryFactoryFor('platforms', platformRepositoryGetter,);
    this.registerInclusionResolver('platforms', this.platforms.inclusionResolver);
    this.contents = this.createHasManyRepositoryFactoryFor('contents', contentRepositoryGetter,);
    this.registerInclusionResolver('contents', this.contents.inclusionResolver);
    this.comments = this.createHasManyRepositoryFactoryFor('comments', commentRepositoryGetter,);
    this.registerInclusionResolver('comments', this.comments.inclusionResolver);
    this.experiences = this.createHasManyRepositoryFactoryFor('experiences', experienceRepositoryGetter,);
    this.registerInclusionResolver('experiences', this.experiences.inclusionResolver);
  }
}
