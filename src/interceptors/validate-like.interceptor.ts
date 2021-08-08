import {
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  service,
  ValueOrPromise,
} from '@loopback/core';
import {repository} from '@loopback/repository';
import {LikeType} from '../enums';
import {LikeRepository, PostRepository} from '../repositories';
import {MetricService} from '../services';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: ValidateLikeInterceptor.BINDING_KEY}})
export class ValidateLikeInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${ValidateLikeInterceptor.name}`;

  constructor(
    @repository(LikeRepository)
    protected likeRepository: LikeRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @service(MetricService)
    protected metricService: MetricService,
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
    const {referenceId, type, userId} = invocationCtx.args[0];
    const like = await this.likeRepository.findOne({
      where: {
        userId,
        type,
        referenceId,
      },
    });

    if (like) {
      like.state = !like.state;
      like.updatedAt = new Date().toString();

      await this.likeRepository.updateById(like.id, like);

      return like;
    }

    invocationCtx.args[0].createdAt = new Date().toString();
    invocationCtx.args[0].updatedAt = new Date().toString();

    // Add pre-invocation logic here
    const result = await next();
    // Add post-invocation logic here
    if (result.type === LikeType.POST) {
      const metric = await this.metricService.publicMetric(result.type, result.referenceId);

      this.postRepository.updateById(referenceId, {
        metric: metric,
      });
    }

    return result;
  }
}
