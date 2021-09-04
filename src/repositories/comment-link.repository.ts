import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {CommentLink, CommentLinkRelations} from '../models';

export class CommentLinkRepository extends DefaultCrudRepository<
  CommentLink,
  typeof CommentLink.prototype.id,
  CommentLinkRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(CommentLink, dataSource);
  }
}
