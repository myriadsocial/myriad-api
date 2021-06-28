import {inject} from '@loopback/core';
import {DefaultCrudRepository, juggler} from '@loopback/repository';
import {RefreshToken, RefreshTokenRelations} from '../models';
import {MongoDataSource} from '../datasources';

export class RefreshTokenRepository extends DefaultCrudRepository<
  RefreshToken,
  typeof RefreshToken.prototype.id,
  RefreshTokenRelations
> {
  constructor(
    @inject('datasources.mongo') 
    dataSource: MongoDataSource
  ) {
    super(RefreshToken, dataSource);
  }
}