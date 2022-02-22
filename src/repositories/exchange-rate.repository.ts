import {inject} from '@loopback/core';
import {DefaultKeyValueRepository} from '@loopback/repository';
import {RedisDataSource} from '../datasources';
import {ExchangeRate} from '../models';

export class ExchangeRateRepository extends DefaultKeyValueRepository<ExchangeRate> {
  constructor(@inject('datasources.redis') dataSource: RedisDataSource) {
    super(ExchangeRate, dataSource);
  }
}
