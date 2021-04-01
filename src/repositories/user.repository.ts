import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, HasManyRepositoryFactory, HasManyThroughRepositoryFactory} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {User, UserRelations, Experience, Comment, SavedExperience} from '../models';
import {ExperienceRepository} from './experience.repository';
import {CommentRepository} from './comment.repository';
import {SavedExperienceRepository} from './saved-experience.repository';

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

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource, @repository.getter('ExperienceRepository') protected experienceRepositoryGetter: Getter<ExperienceRepository>, @repository.getter('CommentRepository') protected commentRepositoryGetter: Getter<CommentRepository>, @repository.getter('SavedExperienceRepository') protected savedExperienceRepositoryGetter: Getter<SavedExperienceRepository>,
  ) {
    super(User, dataSource);
    this.savedExperiences = this.createHasManyThroughRepositoryFactoryFor('savedExperiences', experienceRepositoryGetter, savedExperienceRepositoryGetter,);
    this.registerInclusionResolver('savedExperiences', this.savedExperiences.inclusionResolver);
    this.comments = this.createHasManyRepositoryFactoryFor('comments', commentRepositoryGetter,);
    this.registerInclusionResolver('comments', this.comments.inclusionResolver);
    this.experiences = this.createHasManyRepositoryFactoryFor('experiences', experienceRepositoryGetter,);
    this.registerInclusionResolver('experiences', this.experiences.inclusionResolver);
  }
}
