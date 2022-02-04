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
import {ActivityLogType, PlatformType, ReferenceType} from '../enums';
import {UserRepository} from '../repositories';
import {
  ActivityLogService,
  FriendService,
  PostService,
  TagService,
} from '../services';
import {UrlUtils} from '../utils/url.utils';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: ValidatePostImportURL.BINDING_KEY}})
export class ValidatePostImportURL implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${ValidatePostImportURL.name}`;

  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @service(TagService)
    protected tagService: TagService,
    @service(FriendService)
    protected friendService: FriendService,
    @service(PostService)
    protected postService: PostService,
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
    await this.beforeImport(invocationCtx);

    const result = await next();

    return this.afterImport(invocationCtx, result);
  }

  async beforeImport(invocationCtx: InvocationContext): Promise<void> {
    const urlUtils = new UrlUtils(invocationCtx.args[0].url);
    const platform = urlUtils.getPlatform();
    const originPostId = urlUtils.getOriginPostId();
    const username = urlUtils.getUsername();

    invocationCtx.args[0].url = [platform, originPostId, username].join(',');
  }

  async afterImport(
    invocationCtx: InvocationContext,
    result: AnyObject,
  ): Promise<AnyObject> {
    const importer = invocationCtx.args[0].importer;

    const user = await this.userRepository.findOne({where: {id: importer}});
    const {count} = await this.postService.postRepository.count({
      originPostId: result.originPostId,
      platform: result.platform,
    });

    await this.tagService.createTags(result.tags);
    await this.postService.postRepository.updateAll(
      {totalImporter: count},
      {originPostId: result.originPostId, platform: result.platform},
    );

    await this.activityLogService.createLog(
      ActivityLogType.IMPORTPOST,
      result.createdBy,
      result.id,
      ReferenceType.POST,
    );

    const importerInfo = user ? [Object.assign(user, {name: 'You'})] : [];

    if (result.platform === PlatformType.REDDIT) {
      result.title = result.title.substring(1, result.title.length - 1);
    }

    result.text = result.text.substring(1, result.text.length - 1);

    return {
      ...result,
      importers: importerInfo,
      totalImporter: count,
    };
  }
}
