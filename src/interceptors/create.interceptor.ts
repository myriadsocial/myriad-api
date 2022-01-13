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
  SectionType,
} from '../enums';
import {Comment, UserSocialMedia} from '../models';
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
    @service(VoteService)
    protected voteService: VoteService,
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

        await this.postRepository.findById(postId);
        await this.validateComment(referenceId);

        return;
      }

      case ControllerType.CURRENCY: {
        const data = invocationCtx.args[0];

        invocationCtx.args[0] =
          await this.currencyService.verifyRpcAddressConnection(data);

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
        const {userId, referenceId, type, state, section} =
          invocationCtx.args[0];

        if (type === ReferenceType.POST) {
          const post = await this.postRepository.findById(referenceId, {
            include: [
              {
                relation: 'comments',
                scope: {
                  where: {
                    userId,
                    referenceId,
                    type,
                    section: SectionType.DEBATE,
                  },
                },
              },
            ],
          });

          if (!state) {
            if (
              !post.comments ||
              (post.comments && post.comments.length === 0)
            ) {
              throw new HttpErrors.UnprocessableEntity(
                'Please comment first in debate sections, before you downvote this post',
              );
            }
          }

          invocationCtx.args[0] = Object.assign(invocationCtx.args[0], {
            toUserId: post.createdBy,
            section: undefined,
          });
        }

        if (type === ReferenceType.COMMENT) {
          if (!section) {
            throw new HttpErrors.UnprocessableEntity(
              'Section cannot empty when you upvote/downvote comment',
            );
          }

          const comment = await this.commentRepository.findById(referenceId);

          invocationCtx.args[0] = Object.assign(invocationCtx.args[0], {
            toUserId: comment.userId,
          });
        }

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
        const metric = await this.metricService.postMetric(
          result.type,
          result.referenceId,
          result.postId,
        );

        const popularCount = await this.metricService.countPopularPost(
          result.postId,
        );
        await this.postRepository.updateById(result.postId, {
          metric: metric,
          popularCount: popularCount,
        });
        await this.activityLogService.createLog(
          ActivityLogType.CREATECOMMENT,
          result.userId,
          result.id,
          ReferenceType.COMMENT,
        );

        return Object.assign(result, {metric});
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
}
