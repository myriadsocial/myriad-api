import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {AuthRefreshToken, AuthRefreshTokenRelations} from '../models';

export class AuthRefreshTokenRepository extends DefaultCrudRepository<
  AuthRefreshToken,
  typeof AuthRefreshToken.prototype.id,
  AuthRefreshTokenRelations
> {
  constructor(
    @inject('datasources.mongo')
    dataSource: MongoDataSource,
  ) {
    super(AuthRefreshToken, dataSource);
  }
}
