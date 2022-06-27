import {inject} from '@loopback/core';
import {DefaultKeyValueRepository} from '@loopback/repository';
import {RedisDataSource} from '../datasources';
import {DraftPost} from '../models';

export class DraftPostRepository extends DefaultKeyValueRepository<DraftPost> {
  constructor(@inject('datasources.redis') dataSource: RedisDataSource) {
    super(DraftPost, dataSource);
  }
}
