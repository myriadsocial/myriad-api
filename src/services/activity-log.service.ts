import {BindingScope, injectable} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {ActivityLogType, ReferenceType} from '../enums';
import {ActivityLog} from '../models';
import {ActivityLogRepository, LeaderBoardRepository} from '../repositories';

@injectable({scope: BindingScope.TRANSIENT})
export class ActivityLogService {
  constructor(
    @repository(ActivityLogRepository)
    protected activityLogRepository: ActivityLogRepository,
    @repository(LeaderBoardRepository)
    protected leaderboardRepository: LeaderBoardRepository,
  ) {}

  async createLog(
    type: ActivityLogType,
    userId: string,
    referenceId: string,
    referenceType: ReferenceType,
  ): Promise<void> {
    const {count} = await this.activityLogRepository.count({
      type,
      userId,
      referenceId,
      referenceType,
    });

    const activityLog = new ActivityLog({
      type,
      userId,
      referenceId,
      referenceType,
    });

    if (count >= 1 && type === ActivityLogType.CREATEUSERNAME) {
      throw new HttpErrors.UnprocessableEntity(
        'You can only updated username once',
      );
    }

    await this.activityLogRepository.create(activityLog);

    if (type === ActivityLogType.CREATEUSERNAME) return;
    if (count === 0) {
      // count activity
      const found = await this.leaderboardRepository.findOne({
        where: {
          userId: userId,
        },
      });

      if (found) {
        await this.leaderboardRepository.updateById(found.id, {
          totalActivity: found.totalActivity + 1,
        });
      }
    }
  }
}
