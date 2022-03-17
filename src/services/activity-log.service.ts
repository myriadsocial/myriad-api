import {AuthenticationBindings} from '@loopback/authentication';
import {BindingScope, inject, injectable} from '@loopback/core';
import {repository} from '@loopback/repository';
import {ActivityLogType, ReferenceType} from '../enums';
import {ActivityLog} from '../models';
import {ActivityLogRepository} from '../repositories';
import {UserProfile, securityId} from '@loopback/security';

@injectable({scope: BindingScope.TRANSIENT})
export class ActivityLogService {
  constructor(
    @repository(ActivityLogRepository)
    protected activityLogRepository: ActivityLogRepository,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    protected currentUser: UserProfile,
  ) {}

  async createLog(
    type: ActivityLogType,
    referenceId: string,
    referenceType: ReferenceType,
  ): Promise<void> {
    const activityLog = new ActivityLog({
      type,
      userId: this.currentUser[securityId],
      referenceId,
      referenceType,
    });

    await this.activityLogRepository.create(activityLog);
  }
}
