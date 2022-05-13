import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Server, ServerRelations} from '../models';

export class ServerRepository extends DefaultCrudRepository<
  Server,
  typeof Server.prototype.id,
  ServerRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(Server, dataSource);
  }
}
