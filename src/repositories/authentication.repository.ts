import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Authentication, AuthenticationRelations} from '../models';

export type Credentials = {
  email: string;
  password: string;
}

export class AuthenticationRepository extends DefaultCrudRepository<
  Authentication,
  typeof Authentication.prototype.id,
  AuthenticationRelations
> {
  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
  ) {
    super(Authentication, dataSource);
  }
}
