import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, HasManyThroughRepositoryFactory} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Tag, TagRelations, Experience} from '../models';
// import {SavedTag} from '../models'
// import {SavedTagRepository} from './saved-tag.repository';
// import {ExperienceRepository} from './experience.repository';

export class TagRepository extends DefaultCrudRepository<
  Tag,
  typeof Tag.prototype.id,
  TagRelations
> {

  // public readonly savedExperiences: HasManyThroughRepositoryFactory<Experience, typeof Experience.prototype.id,
  //         SavedTag,
  //         typeof Tag.prototype.id
  //       >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource, 
    // @repository.getter('SavedTagRepository') protected savedTagRepositoryGetter: Getter<SavedTagRepository>, 
    // @repository.getter('ExperienceRepository') protected experienceRepositoryGetter: Getter<ExperienceRepository>,
  ) {
    super(Tag, dataSource);
    // this.savedExperiences = this.createHasManyThroughRepositoryFactoryFor('savedExperiences', experienceRepositoryGetter, savedTagRepositoryGetter,);
    // this.registerInclusionResolver('savedExperiences', this.savedExperiences.inclusionResolver);
  }
}
