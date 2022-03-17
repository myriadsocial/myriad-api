import {AuthenticationBindings} from '@loopback/authentication';
import {
  inject,
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
import {UserProfile} from '@loopback/security';
import {ControllerType, ReferenceType, SectionType} from '../enums';
import {
  CommentLinkRepository,
  CommentRepository,
  PostRepository,
  UserCurrencyRepository,
  VoteRepository,
} from '../repositories';
import {
  FriendService,
  MetricService,
  NotificationService,
  VoteService,
} from '../services';
import {CommentWithRelations} from '../models';
import {omit} from 'lodash';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: DeleteInterceptor.BINDING_KEY}})
export class DeleteInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${DeleteInterceptor.name}`;

  constructor(
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @repository(CommentLinkRepository)
    protected commentLinkRepository: CommentLinkRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(UserCurrencyRepository)
    protected userCurrencyRepository: UserCurrencyRepository,
    @repository(VoteRepository)
    protected voteRepository: VoteRepository,
    @service(FriendService)
    protected friendService: FriendService,
    @service(MetricService)
    protected metricService: MetricService,
    @service(NotificationService)
    protected notificationService: NotificationService,
    @service(VoteService)
    protected voteService: VoteService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    protected currentUser: UserProfile,
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
    const controllerName = invocationCtx.targetClass.name as ControllerType;

    try {
      await this.beforeDelete(invocationCtx);
      await next();
      await this.afterDelete(invocationCtx);
      if (controllerName === ControllerType.COMMENT)
        return invocationCtx.args[1];
    } catch (err) {
      if (controllerName === ControllerType.USERCURRENCY) throw err;
    }
  }

  async beforeDelete(invocationCtx: InvocationContext): Promise<void> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;

    switch (controllerName) {
      case ControllerType.FRIEND: {
        await this.friendService.removedFriend(invocationCtx.args[1]);
        break;
      }

      case ControllerType.USERCURRENCY: {
        if (
          this.currentUser.defaultCurrency === invocationCtx.args[0].currencyId
        ) {
          throw new HttpErrors.UnprocessableEntity(
            'Please changed your default currency, before deleting it',
          );
        }

        const {count} = await this.userCurrencyRepository.count({
          userId: invocationCtx.args[0].userId,
        });

        if (count === 1) {
          throw new HttpErrors.UnprocessableEntity(
            'You cannot delete your only currency',
          );
        }

        break;
      }

      case ControllerType.VOTE: {
        const vote = await this.voteRepository.findById(invocationCtx.args[0]);
        invocationCtx.args[1] = {
          referenceId: vote.referenceId,
          toUserId: vote.toUserId,
          type: vote.type,
          postId: vote.postId,
        };
        break;
      }
    }
  }

  async afterDelete(invocationCtx: InvocationContext): Promise<void> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;

    switch (controllerName) {
      case ControllerType.COMMENT: {
        const comment: CommentWithRelations = invocationCtx.args[1];
        const {referenceId, postId, post, section} = comment;

        Promise.allSettled([
          this.metricService.countPopularPost(postId),
          this.metricService.publicMetric(ReferenceType.POST, postId),
          this.metricService.publicMetric(ReferenceType.COMMENT, referenceId),
        ]) as Promise<AnyObject>;

        if (post?.metric) {
          const metric = post.metric;

          let totalDiscussions = post.metric.discussions ?? 0;
          let totalDebate = post.metric.debates ?? 0;

          if (section === SectionType.DISCUSSION && totalDiscussions > 0) {
            totalDiscussions -= 1;
          } else if (section === SectionType.DISCUSSION && totalDebate > 0) {
            totalDebate -= 1;
          }

          post.metric = {
            ...metric,
            discussions: totalDiscussions,
            debates: totalDebate,
            comments: totalDiscussions + totalDebate,
          };
        }

        invocationCtx.args[1] = {
          ...invocationCtx.args[1],
          deletedAt: new Date().toString(),
          deleteByUser: true,
          post: post,
        };

        break;
      }

      case ControllerType.EXPERIENCEPOST: {
        const [experienceId, postId] = invocationCtx.args;
        const {id, experienceIndex} = await this.postRepository.findById(
          postId,
        );
        await this.postRepository.updateById(id, {
          experienceIndex: omit(experienceIndex, [experienceId]),
        });
        break;
      }

      case ControllerType.FRIEND: {
        const {requesteeId, requestorId} = invocationCtx.args[1];
        await this.notificationService.cancelFriendRequest(
          requestorId,
          requesteeId,
        );
        await this.metricService.userMetric(requesteeId);
        await this.metricService.userMetric(requestorId);
        break;
      }

      case ControllerType.POST: {
        const [id, post] = invocationCtx.args;
        await this.commentRepository.deleteAll({postId: id});
        await this.metricService.userMetric(post.createdBy);
        await this.metricService.countTags(post.tags);
        break;
      }

      case ControllerType.VOTE: {
        await this.voteService.updateVoteCounter(invocationCtx.args[1]);

        break;
      }
    }
  }

  async removeComment(referenceIds: string[]): Promise<string[] | void> {
    const comments = await this.commentRepository.find({
      where: {
        referenceId: {inq: referenceIds},
      },
    });

    if (comments.length === 0) return;

    const commentIds = comments.map(comment => comment.id ?? '');

    await this.commentRepository.deleteAll({id: {inq: commentIds}});
    await this.commentLinkRepository.deleteAll({
      fromCommentId: {inq: referenceIds},
      toCommentId: {inq: commentIds},
    });

    return this.removeComment(commentIds);
  }
}
