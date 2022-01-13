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
import {ControllerType} from '../enums';
import {
  CommentRepository,
  UserCurrencyRepository,
  VoteRepository,
} from '../repositories';
import {VoteService} from '../services';

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
    @repository(UserCurrencyRepository)
    protected userCurrencyRepository: UserCurrencyRepository,
    @repository(VoteRepository)
    protected voteRepository: VoteRepository,
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
    const data = await this.beforeDelete(invocationCtx);

    const result = await next();

    await this.afterDelete(invocationCtx, data);

    return result;
  }

  async beforeDelete(
    invocationCtx: InvocationContext,
  ): Promise<AnyObject | void> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;

    switch (controllerName) {
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

        return {
          referenceId: vote.referenceId,
          toUserId: vote.toUserId,
          type: vote.type,
          postId: vote.postId,
        };
      }
    }
  }

  async afterDelete(
    invocationCtx: InvocationContext,
    beforeData: AnyObject | void,
  ): Promise<void> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;

    switch (controllerName) {
      case ControllerType.VOTE: {
        if (!beforeData) break;
        await this.voteService.updateVoteCounter(beforeData);

        break;
      }
    }
  }
}
