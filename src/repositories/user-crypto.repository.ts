import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {UserCrypto, UserCryptoRelations} from '../models';

export class UserCryptoRepository extends DefaultCrudRepository<
  UserCrypto,
  typeof UserCrypto.prototype.id,
  UserCryptoRelations
> {
  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
  ) {
    super(UserCrypto, dataSource);
  }
}
