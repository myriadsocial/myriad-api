import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {DetailTransaction, DetailTransactionRelations} from '../models';

export class DetailTransactionRepository extends DefaultCrudRepository<
  DetailTransaction,
  typeof DetailTransaction.prototype.id,
  DetailTransactionRelations
> {
  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
  ) {
    super(DetailTransaction, dataSource);
  }
}
