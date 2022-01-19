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
  ActivityLogType,
  FriendStatusType,
} from '../enums';
import {Comment, DraftPost, Transaction, UserSocialMedia} from '../models';
import {
  CommentRepository,
  ReportRepository,
  UserCurrencyRepository,
  UserReportRepository,
  UserRepository,
} from '../repositories';
import {
  ActivityLogService,
  CurrencyService,
  FriendService,
  MetricService,
  NotificationService,
  PostService,
  TagService,
  VoteService,
} from '../services';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: CreateInterceptor.BINDING_KEY}})
export class CreateInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${CreateInterceptor.name}`;

  constructor(
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @repository(UserCurrencyRepository)
    protected userCurrencyRepository: UserCurrencyRepository,
    @repository(ReportRepository)
    protected reportRepository: ReportRepository,
    @repository(UserReportRepository)
    protected userReportRepository: UserReportRepository,
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
    @service(VoteService)
    protected voteService: VoteService,
    @service(FriendService)
    protected friendService: FriendService,
    @service(PostService)
    protected postService: PostService,
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
    await this.beforeCreate(invocationCtx);

    const result = await next();

    return this.afterCreate(invocationCtx, result);
  }

  async beforeCreate(invocationCtx: InvocationContext): Promise<void> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;

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
        const {referenceId, postId} = invocationCtx.args[0] as Comment;

        await this.postService.postRepository.findById(postId);
        await this.validateComment(referenceId);

        return;
      }

      case ControllerType.CURRENCY: {
        const data = invocationCtx.args[0];

        invocationCtx.args[0] =
          await this.currencyService.verifyRpcAddressConnection(data);

        return;
      }

      case ControllerType.FRIEND: {
        await this.friendService.handlePendingBlockedRequest(
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

      case ControllerType.VOTE: {
        const type = invocationCtx.args[0].type;
        const data: AnyObject = {};

        if (type === ReferenceType.POST) {
          const post = await this.voteService.validatePostVote(
            invocationCtx.args[0],
          );

          data.toUserId = post.createdBy;
          data.section = undefined;
        } else if (type === ReferenceType.COMMENT) {
          const comment = await this.voteService.validateComment(
            invocationCtx.args[0],
          );

          data.toUserId = comment.userId;
        } else throw new HttpErrors.UnprocessableEntity('Type not found');

        invocationCtx.args[0] = Object.assign(invocationCtx.args[0], data);

        break;
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
        await this.createNotification(controllerName, result);
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
          const newPost = await this.postService.createPublishPost(
            result as DraftPost,
          );

          if (newPost.tags.length > 0) {
            await this.tagService.createTags(newPost.tags);
          }

          await this.createNotification(controllerName, newPost);
          await this.metricService.userMetric(newPost.createdBy);
          await this.activityLogService.createLog(
            ActivityLogType.CREATEPOST,
            newPost.createdBy,
            newPost.id,
            ReferenceType.POST,
          );

          return newPost;
        }
        return result;
      }

      case ControllerType.COMMENT: {
        const metric = await this.metricService.postMetric(
          result.type,
          result.referenceId,
          result.postId,
        );

        const popularCount = await this.metricService.countPopularPost(
          result.postId,
        );
        await this.postService.postRepository.updateById(result.postId, {
          metric: metric,
          popularCount: popularCount,
        });
        await this.activityLogService.createLog(
          ActivityLogType.CREATECOMMENT,
          result.userId,
          result.id,
          ReferenceType.COMMENT,
        );
        await this.createNotification(controllerName, result);

        return Object.assign(result, {metric});
      }

      case ControllerType.FRIEND: {
        if (result && result.status === FriendStatusType.PENDING) {
          await this.createNotification(controllerName, result);
          await this.activityLogService.createLog(
            ActivityLogType.FRIENDREQUEST,
            result.requestorId,
            result.requesteeId,
            ReferenceType.USER,
          );
        }

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

      case ControllerType.USERSOCIALMEDIA: {
        await this.currencyService.autoClaimTips(result as UserSocialMedia);

        return result;
      }

      case ControllerType.VOTE: {
        const {_id: id, referenceId, type, userId} = result.value;

        await this.voteService.updateVoteCounter(result.value);
        await this.activityLogService.createLog(
          ActivityLogType.GIVEVOTE,
          userId,
          referenceId,
          type,
        );

        return Object.assign(result.value, {
          id: id,
          _id: undefined,
        });
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

  async createNotification(
    controllerName: ControllerType,
    result: AnyObject,
  ): Promise<void> {
    try {
      switch (controllerName) {
        case ControllerType.COMMENT: {
          await this.notificationService.sendPostComment(result as Comment);
          break;
        }

        case ControllerType.FRIEND: {
          await this.notificationService.sendFriendRequest(result.requesteeId);
          break;
        }

        case ControllerType.POST: {
          await this.notificationService.sendMention(
            result.id,
            result.mentions ?? [],
          );
          break;
        }

        case ControllerType.TRANSACTION: {
          await this.notificationService.sendTipsSuccess(result as Transaction);
          break;
        }
      }
    } catch {
      // ignore
    }
  }
}
