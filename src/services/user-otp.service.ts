import {injectable, BindingScope, service} from '@loopback/core';
import {Count, repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {User, UserOTP, UserWithRelations} from '../models';
import {UserOTPRepository, UserRepository} from '../repositories';
import {EmailService} from './email.service';
import {UserProfile} from '@loopback/security';
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
    currentUser?: UserProfile,
  ): Promise<{token: string}> {
    let user: null | User | UserWithRelations = null;

    if (currentUser) {
      user = new User(currentUser) as UserWithRelations;

      if (!currentUser.email) user.email = email;
    }

    if (!user) {
      user = await this.userRepository.findOne({where: {email: email}});
    }

    if (!user) {
      throw new HttpErrors.UnprocessableEntity('UserNotExists');
    }

    const existingUserOTP = await this.userOTPRepository.findOne({
      where: {userId: user.id.toString()},
    });

    const now = Date.now();
    const userOTP = new UserOTP();
    userOTP.token = this.generateOTP();
    userOTP.userId = user.id.toString();

    if (existingUserOTP) {
      const updatedAt = new Date(existingUserOTP.updatedAt).getTime();
      const expiredAt = new Date(existingUserOTP.expiredAt).getTime();

      if (now < expiredAt) {
        const waitingTime = 60 * 1000;

        if (now - updatedAt < waitingTime) {
          throw new HttpErrors.UnprocessableEntity(
            `${waitingTime / 1000} seconds waiting time`,
          );
        }
      }

      userOTP.id = existingUserOTP.id;
      userOTP.createdAt = existingUserOTP.createdAt;
      userOTP.updatedAt = new Date(now).toString();
      userOTP.expiredAt = new Date(now + 30 * 60 * 1000).toString();
      await this.userOTPRepository.update(userOTP);
    } else {
      await this.userOTPRepository.create(userOTP);
    }

    await this.emailService.sendLoginMagicLink(
      user,
      callbackURL,
      userOTP.token,
    );

    return {token: userOTP.token};
  }

  public async verifyOTP(token: string): Promise<UserOTP | null> {
    return this.userOTPRepository.findOne({
      where: {
        token: token,
        expiredAt: {gt: new Date().toString()},
      },
    });
  }

  public async removeOTP(token: string): Promise<Count> {
    return this.userOTPRepository.deleteAll({
      token: token,
    });
  }
}
