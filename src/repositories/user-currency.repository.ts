import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {UserCurrency, UserCurrencyRelations} from '../models';

export class UserCurrencyRepository extends DefaultCrudRepository<
  UserCurrency,
  typeof UserCurrency.prototype.id,
  UserCurrencyRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(UserCurrency, dataSource);
  }
}
