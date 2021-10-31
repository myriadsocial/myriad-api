import {
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  service,
  ValueOrPromise,
} from '@loopback/core';
import {HttpErrors} from '@loopback/rest';
import {FriendStatusType} from '../enums';
import {FriendService} from '../services';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: ValidateFriendRequestInterceptor.BINDING_KEY}})
export class ValidateFriendRequestInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${ValidateFriendRequestInterceptor.name}`;

  constructor(
    @service(FriendService)
    protected friendService: FriendService,
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
    const {requesteeId, requestorId, status} = invocationCtx.args[0];

    switch (status) {
      case FriendStatusType.BLOCKED: {
        await this.friendService.validateBlockFriendRequest(
          requestorId,
          requesteeId,
        );
        break;
      }

      case FriendStatusType.PENDING: {
        await this.friendService.validateFriendRequest(
          requesteeId,
          requestorId,
        );
        break;
      }

      default:
        throw new HttpErrors.UnprocessableEntity(
          'Please set status to pending or blocked',
        );
    }

    // Add pre-invocation logic here
    const result = await next();
    // Add post-invocation logic here
    return result;
  }
}
