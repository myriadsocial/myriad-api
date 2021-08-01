import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {UserCryptocurrency, UserCryptocurrencyRelations} from '../models';

export class UserCryptocurrencyRepository extends DefaultCrudRepository<
  UserCryptocurrency,
  typeof UserCryptocurrency.prototype.id,
  UserCryptocurrencyRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(UserCryptocurrency, dataSource);
  }
}
