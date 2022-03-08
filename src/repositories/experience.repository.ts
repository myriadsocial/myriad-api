import {Getter, inject, bind, BindingScope} from '@loopback/core';
import {
  BelongsToAccessor,
  DefaultCrudRepository,
  repository,
  HasManyThroughRepositoryFactory,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {
  Experience,
  ExperienceRelations,
  User,
  ExperienceUser,
  Post,
  ExperiencePost,
} from '../models';
import {UserRepository} from './user.repository';
import {ExperienceUserRepository} from './experience-user.repository';
import {ExperiencePostRepository} from './experience-post.repository';
import {PostRepository} from './post.repository';

@bind({scope: BindingScope.SINGLETON})
export class ExperienceRepository extends DefaultCrudRepository<
  Experience,
  typeof Experience.prototype.id,
  ExperienceRelations
> {
  public readonly user: BelongsToAccessor<User, typeof Experience.prototype.id>;

  public readonly users: HasManyThroughRepositoryFactory<
    User,
    typeof User.prototype.id,
    ExperienceUser,
    typeof Experience.prototype.id
  >;

  public readonly posts: HasManyThroughRepositoryFactory<
    Post,
    typeof Post.prototype.id,
    ExperiencePost,
    typeof Experience.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('ExperienceUserRepository')
    protected experienceUserRepositoryGetter: Getter<ExperienceUserRepository>,
    @repository.getter('ExperiencePostRepository')
    protected experiencePostRepositoryGetter: Getter<ExperiencePostRepository>,
    @repository.getter('PostRepository')
    protected postRepositoryGetter: Getter<PostRepository>,
  ) {
    super(Experience, dataSource);
    this.posts = this.createHasManyThroughRepositoryFactoryFor(
      'posts',
      postRepositoryGetter,
      experiencePostRepositoryGetter,
    );
    this.registerInclusionResolver('posts', this.posts.inclusionResolver);
    this.users = this.createHasManyThroughRepositoryFactoryFor(
      'users',
      userRepositoryGetter,
      experienceUserRepositoryGetter,
    );
    this.registerInclusionResolver('users', this.users.inclusionResolver);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}
