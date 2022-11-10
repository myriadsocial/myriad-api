import {AuthenticationBindings} from '@loopback/authentication';
import {BindingScope, inject, injectable, service} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {RequestOTPByEmail, UserByEmail} from '../models';
import {UserRepository} from '../repositories';
import {UserOTPService} from './user-otp.service';
import {UserProfile, securityId} from '@loopback/security';
import validator from 'validator';
import {ChangeEmailRequestRepository} from '../repositories/change-email-request.repository';

@injectable({scope: BindingScope.TRANSIENT})
export class UserService {
  constructor(
    @repository(ChangeEmailRequestRepository)
    private changeEmailRequestRepository: ChangeEmailRequestRepository,
    @repository(UserRepository)
    private userRepository: UserRepository,
    @service(UserOTPService)
    private userOTPService: UserOTPService,
    @inject(AuthenticationBindings.CURRENT_USER)
    private currentUser: UserProfile,
  ) {}

  // ------------------------------------------------

  // ------ Setting ---------------------------------

  public async setEmailSetting(userByEmail: UserByEmail): Promise<void> {
    const {token, email} = userByEmail;

    if (!validator.isEmail(email)) {
      throw new HttpErrors.UnprocessableEntity('Invalid Email Address');
    }

    const validOTP = await this.userOTPService.verifyOTP(token);

    if (!validOTP) {
      throw new HttpErrors.UnprocessableEntity('OTP invalid or expired');
    }

    if (validOTP.userId.toString() !== this.currentUser[securityId]) {
      throw new HttpErrors.Unauthorized('Invalid user');
    }

    const key = `email-request/${this.currentUser[securityId]}`;
    const [users, changeEmailRequest] = await Promise.all([
      this.userRepository.find({
        where: {
          or: [{id: validOTP.userId}, {email}],
        },
      }),
      this.changeEmailRequestRepository.get(key),
    ]);

    if (!users.length) {
      throw new HttpErrors.UnprocessableEntity('User not exists');
    }

    if (users.length > 1) {
      throw new HttpErrors.UnprocessableEntity('Email already Exists');
    }

    if (changeEmailRequest.email !== email) {
      throw new HttpErrors.UnprocessableEntity('Invalid email address');
    }

    await Promise.all([
      this.userOTPService.removeOTP(token),
      this.changeEmailRequestRepository.delete(key),
      this.userRepository.updateById(validOTP.userId, {email}),
    ]);
  }

  public async requestOTPByEmail(
    requestOTP: RequestOTPByEmail,
  ): Promise<{message: string}> {
    if (!validator.isEmail(requestOTP.email)) {
      throw new HttpErrors.UnprocessableEntity('Invalid Email Address');
    }

    const {email, callbackURL} = requestOTP;
    const key = `email-request/${this.currentUser[securityId]}`;
    await Promise.all([
      this.userOTPService.requestByEmail(email, callbackURL, this.currentUser),
      this.changeEmailRequestRepository.set(key, {email}),
    ]);

    await this.changeEmailRequestRepository.expire(key, 30 * 60 * 1000);

    return {
      message: `OTP sent to ${this.currentUser?.email ?? requestOTP.email}`,
    };
  }
}
