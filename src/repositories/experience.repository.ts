import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, DefaultCrudRepository, repository, HasManyThroughRepositoryFactory} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Experience, ExperienceRelations, User, SavedExperience} from '../models';
// import {Tag, SavedTag} from '../models'
import {UserRepository} from './user.repository';
import {SavedExperienceRepository} from './saved-experience.repository';
// import {SavedTagRepository} from './saved-tag.repository';
// import {TagRepository} from './tag.repository';

export class ExperienceRepository extends DefaultCrudRepository<
  Experience,
  typeof Experience.prototype.id,
  ExperienceRelations
> {

  public readonly user: BelongsToAccessor<User, typeof Experience.prototype.id>;

  public readonly savedUsers: HasManyThroughRepositoryFactory<User, typeof User.prototype.id,
          SavedExperience,
          typeof Experience.prototype.id
        >;

  // public readonly savedTags: HasManyThroughRepositoryFactory<Tag, typeof Tag.prototype.id,
  //         SavedTag,
  //         typeof Experience.prototype.id
  //       >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource, @repository.getter('UserRepository') protected userRepositoryGetter: Getter<UserRepository>, @repository.getter('SavedExperienceRepository') protected savedExperienceRepositoryGetter: Getter<SavedExperienceRepository>, 
    // @repository.getter('SavedTagRepository') protected savedTagRepositoryGetter: Getter<SavedTagRepository>, @repository.getter('TagRepository') protected tagRepositoryGetter: Getter<TagRepository>, 
  ) {
    super(Experience, dataSource);
    // this.savedTags = this.createHasManyThroughRepositoryFactoryFor('savedTags', tagRepositoryGetter, savedTagRepositoryGetter,);
    // this.registerInclusionResolver('savedTags', this.savedTags.inclusionResolver);
    this.savedUsers = this.createHasManyThroughRepositoryFactoryFor('savedUsers', userRepositoryGetter, savedExperienceRepositoryGetter,);
    this.registerInclusionResolver('savedUsers', this.savedUsers.inclusionResolver);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter,);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}
