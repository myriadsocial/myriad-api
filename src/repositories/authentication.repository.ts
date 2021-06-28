import {Getter, inject} from '@loopback/core';
import {DefaultCrudRepository, HasOneRepositoryFactory, repository} from '@loopback/repository';
import {Authentication, AuthCredential, AuthenticationRelations} from '../models';
import {AuthCredentialRepository} from './auth-credential.repository';
import {MongoDataSource} from '../datasources';

export type Credentials = {
  email: string;
  password: string;
}

export class AuthenticationRepository extends DefaultCrudRepository<
  Authentication,
  typeof Authentication.prototype.id,
  AuthenticationRelations
> {
  public readonly authCredential: HasOneRepositoryFactory<
    AuthCredential,
    typeof Authentication.prototype.id
  >;
  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('AuthCredentialRepository')
    protected authCredentialRepositoryGetter: Getter<AuthCredentialRepository>,
  ) {
    super(Authentication, dataSource);
    this.authCredential = this.createHasOneRepositoryFactoryFor(
      'authCredential',
      authCredentialRepositoryGetter,
    );
    this.registerInclusionResolver(
      'authCredential',
      this.authCredential.inclusionResolver,
    );
  }

  async findCredentials(
    authenticationId: typeof Authentication.prototype.id,
  ): Promise<AuthCredential | undefined> {
    try {
      return await this.authCredential(authenticationId).get();
    } catch (err) {
      if (err.code === 'ENTITY_NOT_FOUND') {
        return undefined;
      }
      throw err;
    }
  }
}
