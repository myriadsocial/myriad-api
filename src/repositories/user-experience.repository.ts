import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, DefaultCrudRepository, repository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Experience, UserExperience, UserExperienceRelations} from '../models';
import { ExperienceRepository } from './experience.repository';

export class UserExperienceRepository extends DefaultCrudRepository<
  UserExperience,
  typeof UserExperience.prototype.id,
  UserExperienceRelations
> {

  public readonly experience: BelongsToAccessor<Experience, typeof UserExperience.prototype.id>;

  constructor(@inject('datasources.mongo') dataSource: MongoDataSource, @repository.getter('ExperienceRepository') protected experienceRepositoryGetter: Getter<ExperienceRepository>,) {
    super(UserExperience, dataSource);
    this.experience = this.createBelongsToAccessorFor('experience', experienceRepositoryGetter,);
    this.registerInclusionResolver('experience', this.experience.inclusionResolver);
  }
}
