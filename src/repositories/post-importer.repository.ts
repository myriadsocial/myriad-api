import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {PostImporter, PostImporterRelations} from '../models';

export class PostImporterRepository extends DefaultCrudRepository<
  PostImporter,
  typeof PostImporter.prototype.id,
  PostImporterRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(PostImporter, dataSource);
  }
}
