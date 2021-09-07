import {Getter, inject} from '@loopback/core';
import {
  BelongsToAccessor,
  DefaultCrudRepository,
  repository,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {
  Experience,
  UserExperience,
  UserExperienceRelations,
  User,
} from '../models';
import {ExperienceRepository} from './experience.repository';
import {UserRepository} from './user.repository';

export class UserExperienceRepository extends DefaultCrudRepository<
  UserExperience,
  typeof UserExperience.prototype.id,
  UserExperienceRelations
> {
  public readonly experience: BelongsToAccessor<
    Experience,
    typeof UserExperience.prototype.id
  >;

  public readonly user: BelongsToAccessor<
    User,
    typeof UserExperience.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('ExperienceRepository')
    protected experienceRepositoryGetter: Getter<ExperienceRepository>,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(UserExperience, dataSource);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
    this.experience = this.createBelongsToAccessorFor(
      'experience',
      experienceRepositoryGetter,
    );
    this.registerInclusionResolver(
      'experience',
      this.experience.inclusionResolver,
    );
  }
}
