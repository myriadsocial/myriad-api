import {inject} from '@loopback/core';
import {DefaultKeyValueRepository} from '@loopback/repository';
import {RedisDataSource} from '../datasources';
import {Queue} from '../models';

export class QueueRepository extends DefaultKeyValueRepository<Queue> {
  constructor(@inject('datasources.redis') dataSource: RedisDataSource) {
    super(Queue, dataSource);
  }
}
