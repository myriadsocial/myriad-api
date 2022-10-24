import {AuthenticationBindings} from '@loopback/authentication';
import {BindingScope, inject, injectable} from '@loopback/core';
import {repository} from '@loopback/repository';
import {securityId, UserProfile} from '@loopback/security';
import {ActivityLogType, ReferenceType} from '../enums';
import {ActivityLog} from '../models';
import {ActivityLogRepository} from '../repositories';

@injectable({scope: BindingScope.TRANSIENT})
export class ActivityLogService {
  constructor(
    @repository(ActivityLogRepository)
    private activityLogRepository: ActivityLogRepository,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private currentUser: UserProfile,
  ) {}

  async create(
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
