import {injectable, BindingScope, service} from '@loopback/core';
import {repository} from '@loopback/repository';
import {UserOTP} from '../models';
import {UserOTPRepository, UserRepository} from '../repositories';
import {EmailService} from './email.service';

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

  private generateOTP(): number {
    return Math.floor(100000 + Math.random() * 900000);
  }

  public async requestByEmail(email: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: {email: email},
    });

    if (!user) throw new Error('Not Found User');

    const existingUserOTP = await this.userOTPRepository.findOne({
      where: {userId: user.id},
    });

    const userOTP = new UserOTP();
    userOTP.otp = this.generateOTP();
    userOTP.userId = user.id;

    if (existingUserOTP) {
      userOTP.id = existingUserOTP.id;
      userOTP.createdAt = existingUserOTP.createdAt;
      await this.userOTPRepository.update(userOTP);
    } else {
      await this.userOTPRepository.create(userOTP);
    }

    await this.emailService.sendOTP(user, userOTP.otp);
  }

  public async verifyOTP(otp: number): Promise<UserOTP | null> {
    const userOTP = await this.userOTPRepository.findOne({
      where: {
        otp: otp,
        expiredAt: {gt: new Date().toString()},
      },
    });

    return userOTP;
  }
}
