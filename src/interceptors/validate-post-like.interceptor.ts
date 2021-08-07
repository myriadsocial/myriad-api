import {
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  ValueOrPromise,
} from '@loopback/core';
import {repository} from '@loopback/repository';
import {LikeType} from '../enums';
import {LikeRepository} from '../repositories';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: ValidateLikePostInterceptor.BINDING_KEY}})
export class ValidateLikePostInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${ValidateLikePostInterceptor.name}`;

  constructor(
    @repository(LikeRepository)
    protected likeRepository: LikeRepository,
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
  async intercept(invocationCtx: InvocationContext, next: () => ValueOrPromise<InvocationResult>) {
    const [id, like] = invocationCtx.args;
    const foundLike = await this.likeRepository.findOne({
      where: {
        userId: like.userId,
        type: LikeType.POST,
        referenceId: id,
      },
    });

    if (foundLike) {
      foundLike.state = !foundLike.state;
      foundLike.updatedAt = new Date().toString();

      await this.likeRepository.updateById(foundLike.id, foundLike);

      return foundLike;
    }

    like.type = LikeType.POST;
    like.createdAt = new Date().toString();
    like.updatedAt = new Date().toString();

    invocationCtx.args[1] = like;
    // Add pre-invocation logic here
    const result = await next();
    // Add post-invocation logic here
    return result;
  }
}
