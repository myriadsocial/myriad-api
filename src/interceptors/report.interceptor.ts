import {
  /* inject, */
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  ValueOrPromise,
} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {
  MethodType,
  ReferenceType,
  ReportStatusType,
} from '../enums';
import {Report} from '../models';
import {
  CommentRepository,
  PostRepository,
  ReportRepository,
  UserReportRepository,
  UserRepository,
} from '../repositories';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: ReportInterceptor.BINDING_KEY}})
export class ReportInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${ReportInterceptor.name}`;

  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(ReportRepository)
    protected reportRepository: ReportRepository,
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(UserReportRepository)
    protected userReportRepository: UserReportRepository,
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
    const methodName = invocationCtx.methodName as MethodType;
    const reportDetail = invocationCtx.args[1];

    let referenceId = null;
    let referenceType = null;

    if (methodName === MethodType.UPDATEBYID || methodName === MethodType.RESTORE) {
      ({referenceId, referenceType} = await this.reportRepository.findById(invocationCtx.args[0]));

      switch (methodName) {
        case MethodType.UPDATEBYID: {
          const report: Report = invocationCtx.args[1];

          await this.updateReport(
            report,
            referenceId,
            referenceType,
            invocationCtx,
          );

          break;
        }

        case MethodType.RESTORE: {
          await this.restoreDocument(
            referenceId,
            referenceType,
          );

          break;
        }
      }
    }

    // Add pre-invocation logic here
    const result = await next();
    // Add post-invocation logic here

    if (methodName === MethodType.CREATE) {
      const found = await this.userReportRepository.findOne({
        where: {
          reportId: result.id,
          reportedBy: invocationCtx.args[0]
        }
      })

      if (found) throw new HttpErrors.UnprocessableEntity('You have report this user/post/comment');

      await this.userReportRepository.create({
        referenceType: reportDetail.referenceType,
        description: reportDetail.description,
        reportedBy: invocationCtx.args[0],
        reportId: result.id,
      });

      const {count} = await this.userReportRepository.count({
        reportId: result.id.toString(),
      });

      await this.reportRepository.updateById(result.id, {totalReported: count, status: result.status});

      return Object.assign(result, {totalReported: count});
    }

    if (methodName === MethodType.RESTORE && referenceId && referenceType) {
      await this.reportRepository.deleteAll({
        referenceId,
        referenceType,
      });
    }

    return result;
  }

  /* eslint-disable  @typescript-eslint/no-explicit-any */
  async restoreDocument(
    referenceId: string,
    referenceType: ReferenceType,
  ): Promise<void> {
    const where = {
      $unset: {
        deletedAt: '',
      },
    };

    switch (referenceType) {
      case ReferenceType.POST:
        await this.postRepository.updateById(referenceId, <any>where);
        break;

      case ReferenceType.COMMENT:
        await this.commentRepository.updateById(referenceId, <any>where);
        break;

      case ReferenceType.USER:
        await this.userRepository.updateById(referenceId, <any>where);
        break;

      default:
        throw new HttpErrors.UnprocessableEntity('ReferenceId not found!');
    }

    const reports = await this.reportRepository.find({
      where: {
        referenceType,
        referenceId,
      },
    });

    const reportIds = reports.map(report => {
      return {
        reportId: report.id,
      };
    });

    await this.userReportRepository.deleteAll({
      or: reportIds,
    });
  }

  async updateReport(
    report: Report,
    referenceId: string,
    referenceType: ReferenceType,
    invocationCtx: InvocationContext,
  ): Promise<void> {
    if (report.status === ReportStatusType.REMOVED) {
      switch (referenceType) {
        case ReferenceType.POST: {
          await this.postRepository.updateById(referenceId, {
            deletedAt: new Date().toString(),
          });

          break
        }

        case ReferenceType.COMMENT: {
          await this.commentRepository.updateById(referenceId, {
            deletedAt: new Date().toString(),
          });

          break;
        }

        case ReferenceType.USER: {
          await this.userRepository.updateById(referenceId, {
            deletedAt: new Date().toString(),
          });
        }
      }
    }

    invocationCtx.args[1] = report;
  }
}
