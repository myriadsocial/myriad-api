import {BindingScope, injectable} from '@loopback/core';
import {repository} from '@loopback/repository';
import {ActivityLogType, ReferenceType} from '../enums';
import {ActivityLog} from '../models';
import {ActivityLogRepository} from '../repositories';

@injectable({scope: BindingScope.TRANSIENT})
export class ActivityLogService {
  constructor(
    @repository(ActivityLogRepository)
    protected activityLogRepository: ActivityLogRepository,
  ) {}

  async createLog(
    type: ActivityLogType,
    userId: string,
    referenceId: string,
    referenceType: ReferenceType,
  ): Promise<void> {
    const activityLog = new ActivityLog({
      type,
      userId,
      referenceId,
      referenceType,
    });

    await this.activityLogRepository.create(activityLog);
  }
}
