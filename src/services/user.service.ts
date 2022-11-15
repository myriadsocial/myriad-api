import {AuthenticationBindings} from '@loopback/authentication';
import {BindingScope, inject, injectable, service} from '@loopback/core';
import {Count, repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {RequestOTPByEmail, UserByEmail} from '../models';
import {
  CommentRepository,
  UserRepository,
  WalletRepository,
} from '../repositories';
import {UserOTPService} from './user-otp.service';
import {UserProfile, securityId} from '@loopback/security';
import validator from 'validator';
import {ChangeEmailRequestRepository} from '../repositories/change-email-request.repository';
import {PostService} from './post.service';

@injectable({scope: BindingScope.TRANSIENT})
export class UserService {
  constructor(
    @repository(ChangeEmailRequestRepository)
    private changeEmailRequestRepository: ChangeEmailRequestRepository,
    @repository(CommentRepository)
    private commentRepository: CommentRepository,
    @repository(UserRepository)
    private userRepository: UserRepository,
    @repository(WalletRepository)
    private walletRepository: WalletRepository,
    @service(PostService)
    private postService: PostService,
    @service(UserOTPService)
    private userOTPService: UserOTPService,
    @inject(AuthenticationBindings.CURRENT_USER)
    private currentUser: UserProfile,
  ) {}

  // ------------------------------------------------

  // ------ Setting ---------------------------------

  public async setEmailSetting(
    userByEmail: Partial<UserByEmail>,
  ): Promise<void> {
    const currentEmail = this.currentUser?.email;

    let action = true; // Action Add/Remove email, true = add email, false = remove email
    if (userByEmail.email) {
      // Add email
      if (currentEmail) {
        throw new HttpErrors.UnprocessableEntity('Email already exists');
      }
    } else {
      // Remove email
      const wallets = await this.walletRepository.find({
        where: {userId: this.currentUser?.[securityId] ?? ''},
      });

      if (wallets.length === 0) {
        throw new HttpErrors.UnprocessableEntity('CannotRemoveEmail');
      }

      if (currentEmail) userByEmail.email = currentEmail;
      action = false;
    }

    const {token, email} = userByEmail;

    if (!token) {
      throw new HttpErrors.UnprocessableEntity('OTP invalid or expired');
    }

    if ((email && !validator.isEmail(email)) || !email) {
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

    if (changeEmailRequest?.email !== email) {
      throw new HttpErrors.UnprocessableEntity('Invalid email address');
    }

    await Promise.all([
      this.userOTPService.removeOTP(token),
      this.changeEmailRequestRepository.delete(key),
      this.userRepository.updateById(validOTP.userId, {
        email: action ? email : undefined,
      }),
    ]);
  }

  public async requestOTPByEmail(
    requestOTP: RequestOTPByEmail,
  ): Promise<{message: string}> {
    if (this.currentUser.email && this.currentUser.email !== requestOTP.email) {
      throw new HttpErrors.UnprocessableEntity('EmailAlreadyRegistered');
    }

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
      message: `OTP sent to ${requestOTP.email}`,
    };
  }

  // ------------------------------------------------

  // ------ PrivateMethod ---------------------------

  public async actionCount(): Promise<Count | undefined> {
    if (this.currentUser?.fullAccess) return;
    const userId = this.currentUser?.[securityId] ?? '';
    const now = new Date().setHours(0, 0, 0, 0);
    const [{count: countComment}, {count: countPost}] = await Promise.all([
      this.commentRepository.count({
        userId,
        createdAt: {
          gt: new Date(now).toString(),
        },
      }),
      this.postService.postRepository.count({
        createdBy: userId,
        createdAt: {
          gt: new Date(now).toString(),
        },
      }),
    ]);

    const actions = 6;
    return {count: actions - (countComment + countPost)};
  }
}
