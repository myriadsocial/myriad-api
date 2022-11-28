import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {LockableContent, LockableContentRelations} from '../models';

export class LockableContentRepository extends DefaultCrudRepository<
  LockableContent,
  typeof LockableContent.prototype.id,
  LockableContentRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(LockableContent, dataSource);
  }
}
