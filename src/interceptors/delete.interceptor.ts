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
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {UserProfile, securityId} from '@loopback/security';
import {ControllerType, ReferenceType} from '../enums';
import {
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
import {Comment} from '../models';
import {config} from '../config';

const defaultUserProfile: UserProfile = {
  [securityId]: config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY,
};

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
    protected currentUser = defaultUserProfile,
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
    await this.beforeDelete(invocationCtx);

    const result = await next();

    await this.afterDelete(invocationCtx);

    return result;
  }

  async beforeDelete(invocationCtx: InvocationContext): Promise<void> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;

    switch (controllerName) {
      case ControllerType.COMMENT: {
        const commentId = invocationCtx.args[0];
        const comment = await this.commentRepository.findById(commentId);
        invocationCtx.args[1] = comment;
        break;
      }

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
        const {
          type: referenceType,
          referenceId,
          postId,
        } = invocationCtx.args[1] as Comment;

        const popularCount = await this.metricService.countPopularPost(postId);
        const postMetric = await this.metricService.publicMetric(
          ReferenceType.POST,
          postId,
        );
        await this.postRepository.updateById(postId, {
          metric: postMetric,
          popularCount: popularCount,
        });

        if (referenceType === ReferenceType.COMMENT) {
          const commentMetric = await this.metricService.publicMetric(
            referenceType,
            referenceId,
          );
          await this.commentRepository.updateById(referenceId, {
            metric: commentMetric,
          });
        }

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

      case ControllerType.VOTE: {
        await this.voteService.updateVoteCounter(invocationCtx.args[1]);

        break;
      }
    }
  }
}
