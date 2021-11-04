import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {ExchangeRateDataSource} from '../datasources';
import {ExchangeRate, ExchangeRateRelations} from '../models';

export class ExchangeRateRepository extends DefaultCrudRepository<
  ExchangeRate,
  typeof ExchangeRate.prototype.id,
  ExchangeRateRelations
> {
  constructor(
    @inject('datasources.exchangerate') dataSource: ExchangeRateDataSource,
  ) {
    super(ExchangeRate, dataSource);
  }
}
