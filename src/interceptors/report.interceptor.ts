import {
  /* inject, */
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  service,
  ValueOrPromise,
} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {
  MethodType,
  PlatformType,
  ReferenceType,
  ReportStatusType,
} from '../enums';
import {
  CommentRepository,
  ExperienceRepository,
  FriendRepository,
  PostRepository,
  ReportRepository,
  UserExperienceRepository,
  UserReportRepository,
  UserRepository,
} from '../repositories';
import {MetricService} from '../services';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: ReportInterceptor.BINDING_KEY}})
export class ReportInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${ReportInterceptor.name}`;

  constructor(
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
    @repository(ReportRepository)
    protected reportRepository: ReportRepository,
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(UserReportRepository)
    protected userReportRepository: UserReportRepository,
    @repository(UserExperienceRepository)
    protected userExperienceRepository: UserExperienceRepository,
    @service(MetricService)
    protected metricService: MetricService,
  ) {}

  /**
   * This method is used by LoopBack context to produce an interceptor function
   * for the binding.
   *
   * @returns An interceptor function
   */
  value() {
    return this.intercept.bind(this);
  }

  /**
   * The logic to intercept an invocation
   * @param invocationCtx - Invocation context
   * @param next - A function to invoke next interceptor or the target method
   */
  async intercept(
    invocationCtx: InvocationContext,
    next: () => ValueOrPromise<InvocationResult>,
  ) {
    const report = invocationCtx.args[1];
    const methodName = invocationCtx.methodName as MethodType;
    const {referenceId, referenceType} = await this.reportRepository.findById(
      invocationCtx.args[0],
    );

    let updated = true;
    let restored = true;

    if (methodName === MethodType.UPDATEBYID) {
      if (report.status === ReportStatusType.REMOVED) restored = false;
      else updated = false;
    }

    if (updated) await this.updateReport(referenceId, referenceType, restored);

    const result = await next();

    if (methodName === MethodType.RESTORE) {
      await this.reportRepository.deleteAll({
        referenceId,
        referenceType,
      });
    }

    return result;
  }

  async updateReport(
    referenceId: string,
    referenceType: ReferenceType,
    restored: boolean,
  ): Promise<void> {
    let data: AnyObject = {
      $unset: {
        deletedAt: '',
      },
    };

    if (!restored) data = {deletedAt: new Date().toString()};
    else {
      const reports = await this.reportRepository.find({
        where: {
          referenceType,
          referenceId,
        },
      });

      const reportIds = reports.map(report => report.id ?? '');

      await this.userReportRepository.deleteAll({
        reportId: {inq: reportIds},
      });
    }

    switch (referenceType) {
      case ReferenceType.POST: {
        const {platform, url, createdBy} = await this.postRepository.findById(
          referenceId,
        );
        if (platform === PlatformType.MYRIAD) {
          await this.postRepository.updateById(referenceId, data);
        } else {
          if (url) {
            await this.postRepository.updateAll(data, {url: url});
          }
        }

        await this.metricService.userMetric(createdBy);

        break;
      }

      case ReferenceType.COMMENT: {
        await this.commentRepository.updateById(referenceId, data);

        break;
      }

      case ReferenceType.USER: {
        await this.handleUserReports(referenceId, data, restored);

        break;
      }
    }
  }

  async handleUserReports(
    userId: string,
    data: AnyObject,
    restored: boolean,
  ): Promise<void> {
    await this.userRepository.updateById(userId, data);
    await this.friendRepository.updateAll(data, {requesteeId: userId});
    await this.experienceRepository.updateAll(data, {createdBy: userId});
    await this.postRepository.updateAll(
      {banned: !restored},
      {createdBy: userId},
    );
    const experiences = await this.experienceRepository.find({
      where: {
        createdBy: userId,
      },
    });
    const friends = await this.friendRepository.find({
      where: {
        requesteeId: userId,
      },
    });
    const experienceIds = experiences.map(e => e.id ?? '');

    await this.userExperienceRepository.updateAll(data, {
      experienceId: {inq: experienceIds},
      subscribed: false,
    });
    if (!restored) {
      await this.userExperienceRepository.deleteAll({
        experienceId: {inq: experienceIds},
        subscribed: true,
      });
    }
    await this.metricService.userMetric(userId);
    await Promise.all(
      friends.map(async friend => {
        return this.metricService.userMetric(friend.requestorId);
      }),
    );
  }
}
