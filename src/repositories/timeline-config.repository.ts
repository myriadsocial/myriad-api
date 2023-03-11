import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {TimelineConfig, TimelineConfigRelations} from '../models';

export class TimelineConfigRepository extends DefaultCrudRepository<
  TimelineConfig,
  typeof TimelineConfig.prototype.id,
  TimelineConfigRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(TimelineConfig, dataSource);
  }
}
