import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {PostTip, PostTipRelations} from '../models';

export class PostTipRepository extends DefaultCrudRepository<
  PostTip,
  typeof PostTip.prototype.id,
  PostTipRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(PostTip, dataSource);
  }
}
