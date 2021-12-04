import {
  /* inject, */
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  ValueOrPromise,
} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {RestBindings} from '@loopback/rest';
import {FriendStatusType, VisibilityType} from '../enums';
import {FriendRepository} from '../repositories';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: RestrictedPostInterceptor.BINDING_KEY}})
export class RestrictedPostInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${RestrictedPostInterceptor.name}`;

  constructor(
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
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
    const {query} = await invocationCtx.get(RestBindings.Http.REQUEST);
    const {userId} = query;
    const filter = invocationCtx.args[1] ?? {};

    filter.include = filter.include ? [...filter.include, 'user'] : ['user'];

    invocationCtx.args[1] = filter;

    // Add pre-invocation logic here
    const result = await next();
    // Add post-invocation logic here
    return this.restrictedPost(result, userId?.toString());
  }

  async restrictedPost(result: AnyObject, userId?: string): Promise<AnyObject> {
    const creator = result.createdBy;

    switch (result.visibility) {
      case VisibilityType.FRIEND: {
        if (!userId) return {message: 'restricted post'};
        if (userId === creator) return result;
        const friend = await this.friendRepository.findOne({
          where: {
            or: [
              {
                requesteeId: userId,
                requestorId: creator,
              },
              {
                requesteeId: creator,
                requestorId: userId,
              },
            ],
          },
        });

        if (!friend) return {message: 'restricted post'};

        if (friend.status === FriendStatusType.APPROVED) return result;
        return {message: 'restricted post'};
      }

      case VisibilityType.PRIVATE:
        if (userId === creator) return result;
        return {message: 'restricted post'};

      default:
        return result;
    }
  }
}
