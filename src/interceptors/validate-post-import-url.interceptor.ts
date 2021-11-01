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
import {PostRepository} from '../repositories';
import {TagService} from '../services';
import {UrlUtils} from '../utils/url.utils';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: ValidatePostImportURL.BINDING_KEY}})
export class ValidatePostImportURL implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${ValidatePostImportURL.name}`;

  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @service(TagService)
    protected tagService: TagService,
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

    const post = await this.postRepository.findOne({
      where: {originPostId, platform},
    });

    if (post) {
      const importers = post.importers.find(
        userId => userId === invocationCtx.args[0].importer,
      );

      if (importers)
        throw new HttpErrors.UnprocessableEntity(
          'You have already import this post',
        );

      post.importers.push(invocationCtx.args[0].importer);

      await this.postRepository.updateById(post.id, {
        importers: post.importers,
      });

      return post;
    }

    invocationCtx.args[0].url = [platform, originPostId, username].join(',');
    // Add pre-invocation logic here
    const result = await next();

    await this.tagService.createTags(result.tags);
    // Add post-invocation logic here
    return result;
  }
}
