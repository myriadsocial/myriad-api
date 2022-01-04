import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {UserRefreshToken, UserRefreshTokenRelations} from '../models';

export class UserRefreshTokenRepository extends DefaultCrudRepository<
  UserRefreshToken,
  typeof UserRefreshToken.prototype.id,
  UserRefreshTokenRelations
> {
  constructor(
    @inject('datasources.mongo')
    dataSource: MongoDataSource,
  ) {
    super(UserRefreshToken, dataSource);
  }
}
