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
  ExperiencePostRepository,
  ReportRepository,
  UserCurrencyRepository,
  UserReportRepository,
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
    @repository(ExperiencePostRepository)
    protected experiencePostRepository: ExperiencePostRepository,
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
    try {
      await this.beforeCreate(invocationCtx);

      const result = await next();

      return await this.afterCreate(invocationCtx, result);
    } catch (err) {
      const controllerName = invocationCtx.targetClass.name as ControllerType;
      if (controllerName === ControllerType.VOTE) {
        if (err.message === 'CommentFirst') {
          throw new HttpErrors.UnprocessableEntity(
            'Please comment first in debate sections, before you downvote this post',
          );
        }
      } else {
        throw err;
      }
    }
  }

  async beforeCreate(invocationCtx: InvocationContext): Promise<void> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;

    switch (controllerName) {
      case ControllerType.TRANSACTION: {
        const transaction: Transaction = invocationCtx.args[0];
        if (transaction.from === transaction.to) {
          throw new HttpErrors.UnprocessableEntity(
            'From and to address cannot be the same!',
          );
        }

        if (
          transaction.type === ReferenceType.POST ||
          transaction.type === ReferenceType.COMMENT
        ) {
          if (!transaction.referenceId) {
            throw new HttpErrors.UnprocessableEntity(
              'Please insert referenceId',
            );
          }
        }

        await this.currencyService.currencyRepository.findById(
          transaction.currencyId,
        );
        return;
      }

      case ControllerType.COMMENT: {
        const {postId} = invocationCtx.args[0] as Comment;

        await this.postService.postRepository.findById(postId);

        return;
      }

      case ControllerType.CURRENCY: {
        const data = invocationCtx.args[0];
        const currencyId = data.id;
        const found = await this.currencyService.currencyRepository.findOne({
          where: {id: currencyId},
        });

        if (found)
          throw new HttpErrors.UnprocessableEntity('Currency already exists');

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

        const userCurrency = await this.userCurrencyRepository.findOne({
          where: {userId, currencyId},
        });
        if (userCurrency)
          throw new HttpErrors.UnprocessableEntity(
            'User currency already exists',
          );

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

      case ControllerType.TAG: {
        const id = invocationCtx.args[0].id
          .toLowerCase()
          .split(/ +/gi)[0]
          .replace(/[^A-Za-z0-9]/gi, '')
          .trim();
        const tag = await this.tagService.tagRepository.findOne({where: {id}});

        if (tag) throw new HttpErrors.UnprocessableEntity('Tag already exist');

        invocationCtx.args[0] = Object.assign(invocationCtx.args[0], {id});

        break;
      }

      case ControllerType.EXPERIENCEPOST: {
        const [experienceId, postId] = invocationCtx.args;
        const post = await this.postService.postRepository.findById(postId);

        const found = await this.experiencePostRepository.findOne({
          where: {
            postId: postId,
            experienceId: experienceId,
          },
        });

        if (found) {
          throw new HttpErrors.UnprocessableEntity(
            'Already added to experience',
          );
        }
        invocationCtx.args[2] = post?.experienceIndex ?? {};

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

        if (result.type === ReferenceType.POST) {
          await this.metricService.publicMetric(
            result.type,
            result.referenceId,
          );
        }

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
        await this.activityLogService.createLog(
          ActivityLogType.CREATECOMMENT,
          result.userId,
          result.id,
          ReferenceType.COMMENT,
        );
        await this.createNotification(controllerName, result);

        const {type: referenceType, referenceId, postId} = result as Comment;

        const popularCount = await this.metricService.countPopularPost(postId);
        const postMetric = await this.metricService.publicMetric(
          ReferenceType.POST,
          postId,
        );
        await this.postService.postRepository.updateById(postId, {
          metric: postMetric,
          popularCount: popularCount,
        });

        if (result.type === ReferenceType.COMMENT) {
          const commentMetric = await this.metricService.publicMetric(
            referenceType,
            referenceId,
          );
          await this.commentRepository.updateById(referenceId, {
            metric: commentMetric,
          });
        }

        return result;
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

      case ControllerType.EXPERIENCEPOST: {
        const [experienceId, postId] = invocationCtx.args;
        const experienceIndex = invocationCtx.args[2] as AnyObject;
        experienceIndex[experienceId] = 1;
        await this.postService.postRepository.updateById(postId, {
          experienceIndex,
        });

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
        this.currencyService.autoClaimTips(
          result as UserSocialMedia,
        ) as Promise<void>;

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
