import {
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  service,
  ValueOrPromise,
} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {
  ReferenceType,
  ControllerType,
  PostStatus,
  PlatformType,
  ActivityLogType,
} from '../enums';
import {
  CommentRepository,
  DraftPostRepository,
  PostRepository,
  ReportRepository,
  UserCurrencyRepository,
  UserReportRepository,
} from '../repositories';
import {
  ActivityLogService,
  CurrencyService,
  MetricService,
  NotificationService,
  TagService,
  UserService,
} from '../services';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: CreateInterceptor.BINDING_KEY}})
export class CreateInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${CreateInterceptor.name}`;

  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @repository(UserCurrencyRepository)
    protected userCurrencyRepository: UserCurrencyRepository,
    @repository(ReportRepository)
    protected reportRepository: ReportRepository,
    @repository(UserReportRepository)
    protected userReportRepository: UserReportRepository,
    @repository(DraftPostRepository)
    protected draftPostRepository: DraftPostRepository,
    @service(MetricService)
    protected metricService: MetricService,
    @service(CurrencyService)
    protected currencyService: CurrencyService,
    @service(TagService)
    protected tagService: TagService,
    @service(NotificationService)
    protected notificationService: NotificationService,
    @service(ActivityLogService)
    protected activityLogService: ActivityLogService,
    @service(UserService)
    protected userService: UserService,
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
    await this.userService.verifyUser();
    await this.beforeCreate(invocationCtx);

    let result = await next();

    result = await this.afterCreate(invocationCtx, result);

    return result;
  }

  async beforeCreate(invocationCtx: InvocationContext): Promise<void> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;

    await this.userService.authorize(controllerName, invocationCtx.args[0]);

    switch (controllerName) {
      case ControllerType.TRANSACTION: {
        if (invocationCtx.args[0].from === invocationCtx.args[0].to) {
          throw new HttpErrors.UnprocessableEntity(
            'From and to address cannot be the same!',
          );
        }

        await this.currencyService.currencyRepository.findById(
          invocationCtx.args[0].currencyId,
        );
        return;
      }

      case ControllerType.COMMENT: {
        const {referenceId} = invocationCtx.args[0];

        await this.validateComment(referenceId);
        return;
      }

      case ControllerType.CURRENCY: {
        invocationCtx.args[0].id = invocationCtx.args[0].id.toUpperCase();

        const currency = await this.currencyService.currencyRepository.findOne({
          where: {id: invocationCtx.args[0].id},
        });

        if (currency)
          throw new HttpErrors.UnprocessableEntity('Currency already exists!');

        invocationCtx.args[0] =
          await this.currencyService.verifyRpcAddressConnection(
            invocationCtx.args[0],
          );

        return;
      }

      case ControllerType.USERCURRENCY: {
        const {userId, currencyId} = invocationCtx.args[0];

        await this.currencyService.currencyRepository.findById(currencyId);

        const {count} = await this.userCurrencyRepository.count({userId});

        invocationCtx.args[0].currencyId = currencyId;
        invocationCtx.args[0].priority = count + 1;

        return;
      }

      default:
        return;
    }
  }

  async afterCreate(
    invocationCtx: InvocationContext,
    result: AnyObject,
  ): Promise<AnyObject> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;

    switch (controllerName) {
      case ControllerType.TRANSACTION: {
        await this.activityLogService.createLog(
          ActivityLogType.SENDTIP,
          result.from,
          result.id,
          ReferenceType.TRANSACTION,
        );
        return result;
      }

      case ControllerType.POST: {
        if (result.status === PostStatus.PUBLISHED) {
          await this.draftPostRepository.deleteById(result.id);

          delete result.id;
          delete result.status;

          const newPost = await this.postRepository.create(
            Object.assign(result, {platform: PlatformType.MYRIAD}),
          );

          try {
            await this.notificationService.sendMention(
              newPost.id,
              newPost.mentions ?? [],
            );
          } catch {
            // ignore
          }

          if (newPost.tags.length > 0) {
            await this.tagService.createTags(newPost.tags);
          }

          await this.activityLogService.createLog(
            ActivityLogType.CREATEPOST,
            newPost.createdBy,
            newPost.id,
            ReferenceType.POST,
          );

          await this.metricService.userMetric(newPost.createdBy);

          return newPost;
        }
        return result;
      }

      case ControllerType.COMMENT: {
        const post = await this.postRepository.findOne({
          where: {id: result.postId},
        });

        if (!post) return result;

        const metric = await this.metricService.publicMetric(
          result.type,
          result.referenceId,
          result.postId,
          result.section,
        );

        const popularCount = await this.metricService.countPopularPost(
          result.postId,
        );
        await this.postRepository.updateById(result.postId, {
          metric: Object.assign(post.metric, metric),
          popularCount: popularCount,
        });
        await this.activityLogService.createLog(
          ActivityLogType.CREATECOMMENT,
          result.userId,
          result.id,
          ReferenceType.COMMENT,
        );

        return result;
      }

      case ControllerType.USERREPORT: {
        const reportDetail = invocationCtx.args[1];

        const found = await this.userReportRepository.findOne({
          where: {
            reportId: result.id,
            reportedBy: invocationCtx.args[0],
          },
        });

        if (found)
          throw new HttpErrors.UnprocessableEntity(
            'You have report this user/post/comment',
          );

        await this.userReportRepository.create({
          referenceType: reportDetail.referenceType,
          description: reportDetail.description,
          reportedBy: invocationCtx.args[0],
          reportId: result.id,
        });

        const {count} = await this.userReportRepository.count({
          reportId: result.id.toString(),
        });

        await this.reportRepository.updateById(result.id, {
          totalReported: count,
          status: result.status,
        });

        return Object.assign(result, {totalReported: count});
      }

      default:
        return result;
    }
  }

  async validateComment(referenceId: string): Promise<void> {
    const lastComment = await this.commentRepository.findOne({
      where: {
        id: referenceId,
        type: ReferenceType.COMMENT,
      },
    });

    if (!lastComment) return;

    const comment = await this.commentRepository.findOne({
      where: {
        id: lastComment.referenceId,
        type: ReferenceType.COMMENT,
      },
    });

    if (!comment) return;
    throw new HttpErrors.UnprocessableEntity('Cannot added comment anymore');
  }
}