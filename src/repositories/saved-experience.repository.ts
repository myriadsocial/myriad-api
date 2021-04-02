import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {SavedExperience, SavedExperienceRelations} from '../models';

export class SavedExperienceRepository extends DefaultCrudRepository<
  SavedExperience,
  typeof SavedExperience.prototype.id,
  SavedExperienceRelations
> {
  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
  ) {
    super(SavedExperience, dataSource);
  }
}
