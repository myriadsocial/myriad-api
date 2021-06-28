import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {AuthCredential, AuthCredentialRelations} from '../models';
import {MongoDataSource} from '../datasources';

export class AuthCredentialRepository extends DefaultCrudRepository<
  AuthCredential,
  typeof AuthCredential.prototype.id,
  AuthCredentialRelations
> {
  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
  ) {
    super(AuthCredential, dataSource);
  }
}
