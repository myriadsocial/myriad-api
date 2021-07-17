import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Cryptocurrency, CryptocurrencyRelations} from '../models';

export class CryptocurrencyRepository extends DefaultCrudRepository<
  Cryptocurrency,
  typeof Cryptocurrency.prototype.id,
  CryptocurrencyRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(Cryptocurrency, dataSource);
  }
}
