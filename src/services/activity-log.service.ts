import {BindingScope, injectable} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {ActivityLogType, ReferenceType} from '../enums';
import {ActivityLog} from '../models';
import {ActivityLogRepository} from '../repositories';
import {DateUtils} from '../utils/date-utils';

@injectable({scope: BindingScope.TRANSIENT})
export class ActivityLogService {
  constructor(
    @repository(ActivityLogRepository)
    protected activityLogRepository: ActivityLogRepository,
  ) {}

  async userVoteActivityLog(
    userId: string,
    referenceId: string,
    voteType: ReferenceType,
  ): Promise<void> {
    const {count} = await this.activityLogRepository.count({
      referenceId: referenceId,
      userId: userId,
      type: ActivityLogType.GIVEVOTE,
      referenceType: voteType,
    });

    if (count >= 1) return;

    await this.activityLogRepository.create({
      userId: userId,
      type: ActivityLogType.GIVEVOTE,
      referenceId: referenceId,
      referenceType: voteType,
      message: 'You gave vote to ' + voteType,
    });
  }

  async userProfileActivityLog(
    type: ActivityLogType,
    userId: string,
  ): Promise<void> {
    const dateUtils = new DateUtils();

    const message = 'You updated your profile';
    const found = await this.activityLogRepository.find({
      where: {
        userId: userId,
        type: type,
        referenceId: userId,
        referenceType: ReferenceType.USER,
      },
      order: ['createdAt DESC'],
    });

    if (found.length > 0 && type === ActivityLogType.CREATEUSERNAME) {
      throw new HttpErrors.UnprocessableEntity(
        'You can only updated username once',
      );
    }

    const activityLog = found[0];

    if (activityLog && !dateUtils.isToday(activityLog.createdAt ?? '')) return;

    await this.activityLogRepository.create({
      userId: userId,
      type: type,
      referenceType: ReferenceType.USER,
      referenceId: userId,
      message: message,
    });
  }

  async userPostCommentActivityLog(
    type: ActivityLogType,
    userId: string,
    referenceId: string,
  ): Promise<void> {
    const activityLog = new ActivityLog({
      type: type,
      userId: userId,
      referenceId: referenceId,
      referenceType: ReferenceType.POST,
    });

    if (type === ActivityLogType.CREATEPOST) {
      activityLog.message = 'You created a new post';
    } else if (type === ActivityLogType.IMPORTPOST) {
      activityLog.message = 'You have imported a post';
    } else {
      activityLog.message = 'You created a new comment';
      activityLog.referenceType = ReferenceType.COMMENT;
    }

    await this.activityLogRepository.create(activityLog);
  }

  async userFriendRequestActivityLog(
    userId: string,
    referenceId: string,
  ): Promise<void> {
    const {count} = await this.activityLogRepository.count({
      type: ActivityLogType.FRIENDREQUEST,
      userId: userId,
      referenceId: referenceId,
      referenceType: ReferenceType.USER,
    });

    if (count >= 1) return;

    await this.activityLogRepository.create({
      type: ActivityLogType.FRIENDREQUEST,
      userId: userId,
      referenceId: referenceId,
      referenceType: ReferenceType.USER,
      message: 'You made a friend request',
    });
  }

  async userExperienceActivityLog(
    type: ActivityLogType,
    userId: string,
    referenceId: string,
  ): Promise<void> {
    const activityLog = new ActivityLog({
      userId: userId,
      referenceId: referenceId,
      referenceType: ReferenceType.EXPERIENCE,
    });

    if (type === ActivityLogType.CREATEEXPERIENCE) {
      activityLog.type = ActivityLogType.CREATEEXPERIENCE;
      activityLog.message = 'You created a new experience';
    } else {
      const {count} = await this.activityLogRepository.count({
        type: ActivityLogType.SUBSCRIBEEXPERIENCE,
        userId: userId,
        referenceId: referenceId,
        referenceType: ReferenceType.EXPERIENCE,
      });

      if (count >= 1) return;

      activityLog.type = ActivityLogType.SUBSCRIBEEXPERIENCE;
      activityLog.message = 'You subscribed an experience';
    }

    await this.activityLogRepository.create(activityLog);
  }

  async userUserSocialMediaActivityLog(
    userId: string,
    referenceId: string,
  ): Promise<void> {
    const {count} = await this.activityLogRepository.count({
      type: ActivityLogType.CLAIMSOCIAL,
      userId: userId,
      referenceId: referenceId,
      referenceType: ReferenceType.PEOPLE,
    });

    if (count >= 1) return;

    await this.activityLogRepository.create({
      type: ActivityLogType.CLAIMSOCIAL,
      userId: userId,
      referenceId: referenceId,
      referenceType: ReferenceType.PEOPLE,
      message: 'You claimed social media',
    });
  }

  async userTipActivityLog(
    type: ActivityLogType,
    userId: string,
    referenceId: string,
  ): Promise<void> {
    const activityLog = new ActivityLog({
      userId: userId,
      referenceId: referenceId,
      referenceType: ReferenceType.TRANSACTION,
    });

    if (type === ActivityLogType.SENDTIP) {
      activityLog.type = ActivityLogType.SENDTIP;
      activityLog.message = 'You send tips';
    } else {
      activityLog.type = ActivityLogType.CLAIMTIP;
      activityLog.message = 'You claim tips';
    }

    await this.activityLogRepository.create(activityLog);
  }
}
