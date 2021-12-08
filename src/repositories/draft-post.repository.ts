import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {DraftPost, DraftPostRelations} from '../models';

export class DraftPostRepository extends DefaultCrudRepository<
  DraftPost,
  typeof DraftPost.prototype.id,
  DraftPostRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(DraftPost, dataSource);
  }
}
