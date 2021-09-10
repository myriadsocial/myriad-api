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
import {HttpErrors} from '@loopback/rest';
import {ReferenceType, MethodType, SectionType} from '../enums';
import {
  CommentRepository,
  LikeRepository,
  PostRepository,
} from '../repositories';
import {MetricService} from '../services';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: ValidateLikeInterceptor.BINDING_KEY}})
export class ValidateLikeInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${ValidateLikeInterceptor.name}`;

  constructor(
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
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
  async intercept(
    invocationCtx: InvocationContext,
    next: () => ValueOrPromise<InvocationResult>,
  ) {
    const methodName = invocationCtx.methodName as MethodType;
    const {type, referenceId} = await this.beforeCreation(
      methodName,
      invocationCtx,
    );

    const result = await next();
    await this.afterCreation(type, referenceId);

    if (methodName === MethodType.CREATELIKE) {
      return Object.assign(result.value, {
        id: result.value._id,
        _id: undefined,
      });
    }

    return result;
  }

  async beforeCreation(
    methodName: MethodType,
    invocationCtx: InvocationContext,
  ): Promise<{referenceId: string; type: ReferenceType}> {
    if (methodName === MethodType.DELETEBYID) {
      const like = await this.likeRepository.findById(invocationCtx.args[0]);

      return {
        referenceId: like.referenceId,
        type: like.type,
      };
    }

    const {userId, referenceId, type, state, section} = invocationCtx.args[0];

    if (type === ReferenceType.POST) invocationCtx.args[0].section = undefined;
    if (type === ReferenceType.COMMENT && !section)
      throw new HttpErrors.UnprocessableEntity(
        'Section cannot empty when you like/dislike comment',
      );

    if (state === false) {
      switch (type) {
        case ReferenceType.POST: {
          const postComment = await this.commentRepository.findOne({
            where: {userId, referenceId, type, section: SectionType.DEBATE},
          });
          if (postComment) break;
          throw new HttpErrors.UnprocessableEntity(
            'Please comment first in debate sections, before you dislike this post',
          );
        }

        case ReferenceType.COMMENT: {
          const comment = await this.commentRepository.findOne({
            where: {userId, referenceId, type, section},
          });
          if (comment) break;
          throw new HttpErrors.UnprocessableEntity(
            `Please comment first in ${section} sections, before you dislike this comment`,
          );
        }
      }
    }

    return {
      referenceId: referenceId,
      type: type,
    };
  }

  async afterCreation(type: ReferenceType, referenceId: string): Promise<void> {
    const metric = await this.metricService.publicMetric(type, referenceId);

    switch (type) {
      case ReferenceType.POST: {
        const post = await this.postRepository.findById(referenceId);
        return this.postRepository.updateById(referenceId, {
          metric: Object.assign(post.metric, metric),
        });
      }

      case ReferenceType.COMMENT:
        return this.commentRepository.updateById(referenceId, {
          metric: metric,
        });

      default:
        return;
    }
  }
}
