import {Getter, inject} from '@loopback/core';
import {
  BelongsToAccessor,
  DefaultCrudRepository,
  HasManyThroughRepositoryFactory,
  repository,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {
  Experience,
  ExperienceRelations,
  SavedExperience,
  User,
} from '../models';
import {SavedExperienceRepository} from './saved-experience.repository';
import {UserRepository} from './user.repository';

export class ExperienceRepository extends DefaultCrudRepository<
  Experience,
  typeof Experience.prototype.id,
  ExperienceRelations
> {
  public readonly user: BelongsToAccessor<User, typeof Experience.prototype.id>;

  public readonly savedUsers: HasManyThroughRepositoryFactory<
    User,
    typeof User.prototype.id,
    SavedExperience,
    typeof Experience.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('SavedExperienceRepository')
    protected savedExperienceRepositoryGetter: Getter<SavedExperienceRepository>,
  ) {
    super(Experience, dataSource);
    this.savedUsers = this.createHasManyThroughRepositoryFactoryFor(
      'users',
      userRepositoryGetter,
      savedExperienceRepositoryGetter,
    );
    this.registerInclusionResolver('users', this.savedUsers.inclusionResolver);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}
