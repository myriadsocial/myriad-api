import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {UserToken, UserTokenRelations} from '../models';

export class UserTokenRepository extends DefaultCrudRepository<
  UserToken,
  typeof UserToken.prototype.id,
  UserTokenRelations
> {
  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
  ) {
    super(UserToken, dataSource);
  }
}
