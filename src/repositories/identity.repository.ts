import {inject} from '@loopback/core';
import {DefaultKeyValueRepository} from '@loopback/repository';
import {RedisDataSource} from '../datasources';
import {Identity} from '../models';

export class IdentityRepository extends DefaultKeyValueRepository<Identity> {
  constructor(@inject('datasources.redis') dataSource: RedisDataSource) {
    super(Identity, dataSource);
  }
}
