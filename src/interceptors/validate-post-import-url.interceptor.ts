import {
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  service,
  ValueOrPromise,
} from '@loopback/core';
import {FriendService, PostService, TagService} from '../services';
import {UrlUtils} from '../utils/url.utils';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: ValidatePostImportURL.BINDING_KEY}})
export class ValidatePostImportURL implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${ValidatePostImportURL.name}`;

  constructor(
    @service(TagService)
    protected tagService: TagService,
    @service(FriendService)
    protected friendService: FriendService,
    @service(PostService)
    protected postService: PostService,
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
    const urlUtils = new UrlUtils(invocationCtx.args[0].url);
    const platform = urlUtils.getPlatform();
    const originPostId = urlUtils.getOriginPostId();
    const username = urlUtils.getUsername();

    invocationCtx.args[0].url = [platform, originPostId, username].join(',');
    // Add pre-invocation logic here
    const result = await next();

    await this.tagService.createTags(result.tags);

    const userId = result.createdBy;
    const friendIds = await this.friendService.getImporterIds(userId);
    const detailImporters = await this.postService.getDetailImporters(
      result,
      friendIds,
    );
    // Add post-invocation logic here
    return Object.assign(result, detailImporters);
  }
}
