import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {ExperiencePost, ExperiencePostRelations} from '../models';

export class ExperiencePostRepository extends DefaultCrudRepository<
  ExperiencePost,
  typeof ExperiencePost.prototype.id,
  ExperiencePostRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(ExperiencePost, dataSource);
  }
}
