import {injectable, BindingScope, service} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {UserOTP} from '../models';
import {UserOTPRepository, UserRepository} from '../repositories';
import {EmailService} from './email.service';
import crypto from 'crypto';

@injectable({scope: BindingScope.TRANSIENT})
export class UserOTPService {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(UserOTPRepository)
    protected userOTPRepository: UserOTPRepository,
    @service(EmailService)
    protected emailService: EmailService,
  ) {}

  private generateOTP(): string {
    return crypto.randomBytes(20).toString('hex');
  }

  public async requestByEmail(
    email: string,
    callbackURL: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: {email: email},
    });

    if (!user) throw new HttpErrors.NotFound('User not exists!');

    const existingUserOTP = await this.userOTPRepository.findOne({
      where: {userId: user.id},
    });

    const userOTP = new UserOTP();
    userOTP.token = this.generateOTP();
    userOTP.userId = user.id;
    userOTP.expiredAt = new Date(new Date().getTime() + 30 * 60000).toString();

    if (existingUserOTP) {
      userOTP.id = existingUserOTP.id;
      userOTP.createdAt = existingUserOTP.createdAt;
      userOTP.updatedAt = new Date().toString();
      await this.userOTPRepository.update(userOTP);
    } else {
      await this.userOTPRepository.create(userOTP);
    }

    await this.emailService.sendLoginMagicLink(
      user,
      callbackURL,
      userOTP.token,
    );
  }

  public async verifyOTP(token: string): Promise<UserOTP | null> {
    const userOTP = await this.userOTPRepository.findOne({
      where: {
        token: token,
        expiredAt: {gt: new Date().toString()},
      },
    });

    return userOTP;
  }
}
