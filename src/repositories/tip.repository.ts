import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Tip, TipRelations} from '../models';

export class TipRepository extends DefaultCrudRepository<
  Tip,
  typeof Tip.prototype.id,
  TipRelations
> {
  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
  ) {
    super(Tip, dataSource);
  }
}
