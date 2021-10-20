import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {ReportUser, ReportUserRelations} from '../models';

export class ReportUserRepository extends DefaultCrudRepository<
  ReportUser,
  typeof ReportUser.prototype.id,
  ReportUserRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(ReportUser, dataSource);
  }
}
