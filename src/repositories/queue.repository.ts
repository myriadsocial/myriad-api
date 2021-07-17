import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Queue, QueueRelations} from '../models';

export class QueueRepository extends DefaultCrudRepository<
  Queue,
  typeof Queue.prototype.id,
  QueueRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(Queue, dataSource);
  }
}
