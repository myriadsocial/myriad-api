import {UserService} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {PasswordHasherBindings} from '../keys';
import {Authentication} from '../models';
import {Credentials, AuthenticationRepository} from '../repositories/authentication.repository';
import {BcryptHasher} from './hash.password.service';

export class MyAuthService implements UserService<Authentication, Credentials>{
  constructor(
    @repository(AuthenticationRepository)
    public authenticationRepository: AuthenticationRepository,

    // @inject('service.hasher')
    @inject(PasswordHasherBindings.PASSWORD_HASHER)
    public hasher: BcryptHasher

  ) {}
  async verifyCredentials(credentials: Credentials): Promise<Authentication> {
    // implement this method
    const foundAuth = await this.authenticationRepository.findOne({
      where: {
        email: credentials.email
      }
    });
    if (!foundAuth) {
      throw new HttpErrors.NotFound('auth not found');
    }
    const passwordMatched = await this.hasher.comparePassword(credentials.password, foundAuth.password)
    if (!passwordMatched)
      throw new HttpErrors.Unauthorized('password is not valid');
    return foundAuth;
  }

  convertToUserProfile(auth: Authentication): UserProfile {
    return {
      [securityId]: auth.id!.toString(),
      id: auth.id,
      email: auth.email
    };
    // throw new Error('Method not implemented.');
  }

}