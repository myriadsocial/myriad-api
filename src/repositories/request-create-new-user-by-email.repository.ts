import {inject} from '@loopback/core';
import {DefaultKeyValueRepository} from '@loopback/repository';
import {RedisDataSource} from '../datasources';
import {RequestCreateNewUserByEmail} from '../models';

export class RequestCreateNewUserByEmailRepository extends DefaultKeyValueRepository<RequestCreateNewUserByEmail> {
  constructor(@inject('datasources.redis') dataSource: RedisDataSource) {
    super(RequestCreateNewUserByEmail, dataSource);
  }
}
