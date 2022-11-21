import {BindingScope, inject, injectable, service} from '@loopback/core';
import {
  Credential,
  RequestCreateNewUserByEmail,
  RequestCreateNewUserByWallet,
  RequestLoginByOTP,
  RequestOTPByEmail,
  User,
} from '../../models';
import isEmail from 'validator/lib/isEmail';
import {HttpErrors} from '@loopback/rest';
import {UserOTPService} from '../user-otp.service';
import {repository} from '@loopback/repository';
import {
  RequestCreateNewUserByEmailRepository,
  UserRepository,
  WalletRepository,
} from '../../repositories';
import {pick} from 'lodash';
import {securityId, UserProfile} from '@loopback/security';
import {TokenObject} from '../../interfaces';
import {TokenServiceBindings} from '../../keys';
import {JWTService} from './jwt.service';

@injectable({scope: BindingScope.TRANSIENT})
export class AuthService {
  constructor(
    @repository(RequestCreateNewUserByEmailRepository)
    private requestCreateNewUserByEmailRepository: RequestCreateNewUserByEmailRepository,
    @repository(UserRepository)
    private userRepository: UserRepository,
    @repository(WalletRepository)
    private walletRepository: WalletRepository,
    @service(UserOTPService)
    private userOTPService: UserOTPService,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    private jwtService: JWTService,
  ) {}

  public async getNonce(id?: string, type?: string): Promise<{nonce: number}> {
    if (!id || !type) return {nonce: 0};

    switch (type) {
      case 'wallet':
        return this.walletRepository
          .user(id)
          .then(user => ({nonce: user.nonce}))
          .catch(() => ({nonce: 0}));

      case 'user':
        return this.userRepository
          .findById(id)
          .then(user => ({nonce: user.nonce}))
          .catch(() => ({nonce: 0}));

      default:
        return {nonce: 0};
    }
  }

  public async requestOTPByEmail(
    requestOTP: RequestOTPByEmail,
  ): Promise<{message: string}> {
    const {email, callbackURL} = requestOTP;

    if (isEmail(email)) {
      throw new HttpErrors.UnprocessableEntity('InvalidEmailAddress');
    }

    await this.userOTPService.requestByEmail(email, callbackURL);

    return {message: `OTP sent to ${requestOTP.email}`};
  }

  public async signUpByEmail(
    requestCreateNewUserByEmail: RequestCreateNewUserByEmail,
  ): Promise<User> {
    const {email, callbackURL} = requestCreateNewUserByEmail;
    const user = pick(requestCreateNewUserByEmail, [
      'id',
      'name',
      'username',
      'email',
    ]);
    const currentUser: UserProfile = {
      [securityId]: user.id.toString(),
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
    };
    const {token} = await this.userOTPService.requestByEmail(
      email,
      callbackURL,
      currentUser,
    );
    const key = `sign-up/${token}`;
    await this.requestCreateNewUserByEmailRepository.set(key, user);
    await this.requestCreateNewUserByEmailRepository.expire(
      key,
      30 * 60 * 1000,
    );
    return new User(currentUser);
  }

  public async signUpByWallet(
    requestCreateNewUserByWallet: RequestCreateNewUserByWallet,
  ): Promise<User> {
    const user = pick(requestCreateNewUserByWallet, [
      'id',
      'name',
      'username',
      'permissions',
      'fullAccess',
    ]);

    return this.userRepository.create(user);
  }

  public async login(
    requestLogin: Credential | RequestLoginByOTP,
  ): Promise<TokenObject> {
    const accessToken = await this.jwtService.generateToken(
      requestLogin.data as UserProfile,
    );

    return {accessToken};
  }
}
