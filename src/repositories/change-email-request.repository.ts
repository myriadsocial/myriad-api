import {inject} from '@loopback/core';
import {DefaultKeyValueRepository} from '@loopback/repository';
import {RedisDataSource} from '../datasources';
import {ChangeEmailRequest} from '../models';

export class ChangeEmailRequestRepository extends DefaultKeyValueRepository<ChangeEmailRequest> {
  constructor(@inject('datasources.redis') dataSource: RedisDataSource) {
    super(ChangeEmailRequest, dataSource);
  }
}
