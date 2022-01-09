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
  MethodType,
  SectionType,
  ActivityLogType,
} from '../enums';
import {
  CommentRepository,
  VoteRepository,
  PostRepository,
} from '../repositories';
import {MetricService} from '../services';
import {ActivityLogService} from '../services/activity-log.service';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: ValidateVoteInterceptor.BINDING_KEY}})
export class ValidateVoteInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${ValidateVoteInterceptor.name}`;

  constructor(
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @repository(VoteRepository)
    protected voteRepository: VoteRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @service(MetricService)
    protected metricService: MetricService,
    @service(ActivityLogService)
    protected activityLogService: ActivityLogService,
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
    const voteDetail = await this.beforeVote(invocationCtx);

    const result = await next();

    return this.afterVote(invocationCtx, voteDetail, result);
  }

  async beforeVote(invocationCtx: InvocationContext): Promise<AnyObject> {
    const methodName = invocationCtx.methodName as MethodType;

    if (methodName === MethodType.DELETEBYID) {
      const vote = await this.voteRepository.findById(invocationCtx.args[0]);

      return {
        referenceId: vote.referenceId,
        toUserId: vote.toUserId,
        type: vote.type,
      };
    }

    const {userId, referenceId, type, state, section} = invocationCtx.args[0];

    let toUserId = null;

    if (type === ReferenceType.POST) {
      ({createdBy: toUserId} = await this.postRepository.findById(referenceId));

      invocationCtx.args[0] = Object.assign(invocationCtx.args[0], {
        toUserId: toUserId,
        section: undefined,
      });
    }

    if (type === ReferenceType.COMMENT) {
      if (!section) {
        throw new HttpErrors.UnprocessableEntity(
          'Section cannot empty when you upvote/downvote comment',
        );
      }

      ({userId: toUserId} = await this.commentRepository.findById(referenceId));

      invocationCtx.args[0] = Object.assign(invocationCtx.args[0], {
        toUserId: toUserId,
      });
    }

    if (state === false && type === ReferenceType.POST) {
      const postComment = await this.commentRepository.findOne({
        where: {userId, referenceId, type, section: SectionType.DEBATE},
      });
      if (!postComment)
        throw new HttpErrors.UnprocessableEntity(
          'Please comment first in debate sections, before you downvote this post',
        );
    }

    return {
      referenceId: referenceId,
      toUserId: toUserId,
      type: type,
    };
  }

  async afterVote(
    invocationCtx: InvocationContext,
    voteDetail: AnyObject,
    result: AnyObject,
  ): Promise<AnyObject> {
    const methodName = invocationCtx.methodName as MethodType;

    if (methodName === MethodType.CREATEVOTE) {
      const {
        _id: id,
        postId,
        referenceId: refId,
        type: refType,
        userId,
      } = result.value;
      const popularCount = await this.metricService.countPopularPost(postId);

      await this.postRepository.updateById(postId, {popularCount});
      await this.activityLogService.createLog(
        ActivityLogType.GIVEVOTE,
        userId,
        refId,
        refType,
      );

      return Object.assign(result.value, {
        id: id,
        _id: undefined,
      });
    }

    const {type, referenceId, toUserId} = voteDetail;
    const metric = await this.metricService.postMetric(type, referenceId);

    await this.metricService.userMetric(toUserId);

    switch (type) {
      case ReferenceType.POST: {
        const post = await this.postRepository.findOne({
          where: {id: referenceId},
        });
        if (!post) break;

        await this.postRepository.updateById(referenceId, {
          metric: Object.assign(post.metric, metric),
        });
        break;
      }

      case ReferenceType.COMMENT:
        await this.commentRepository.updateById(referenceId, {
          metric: metric,
        });
        break;
    }

    return result;
  }
}
