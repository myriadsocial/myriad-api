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
import {ActivityLogType, PlatformType, VisibilityType} from '../enums';
import {ExtendedPost} from '../interfaces';
import {PlatformPost} from '../models/platform-post.model';
import {UserRepository} from '../repositories';
import {
  ActivityLogService,
  FriendService,
  PostService,
  SocialMediaService,
  TagService,
} from '../services';
import {formatTag} from '../utils/format-tag';
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
    @service(SocialMediaService)
    protected socialMediaService: SocialMediaService,
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
    const platformPost = Object.assign(invocationCtx.args[0], {
      url: [platform, originPostId, username].join(','),
    });

    await this.postService.validateImportedPost(platformPost);

    const rawPost = await this.getSocialMediaPost(platformPost);

    invocationCtx.args[0].rawPost = rawPost;
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
      banned: false,
      deletedAt: {exists: false},
    });

    Promise.allSettled([
      this.tagService.createTags(result.tags),
      this.activityLogService.createLog(
        ActivityLogType.IMPORTPOST,
        result.createdBy,
        result.id,
      ),
    ]) as Promise<AnyObject>;

    return {
      ...result,
      importers: user ? [Object.assign(user, {name: 'You'})] : [],
      totalImporter: count,
    };
  }

  async getSocialMediaPost(platformPost: PlatformPost): Promise<ExtendedPost> {
    const [platform, originPostId] = platformPost.url.split(',');

    let rawPost = null;
    switch (platform) {
      case PlatformType.TWITTER:
        rawPost = await this.socialMediaService.fetchTweet(originPostId);
        break;

      case PlatformType.REDDIT:
        rawPost = await this.socialMediaService.fetchRedditPost(originPostId);
        break;

      default:
        throw new HttpErrors.NotFound('Cannot find the platform!');
    }

    if (!rawPost)
      throw new HttpErrors.NotFound('Cannot find the specified post');
    rawPost.visibility = platformPost.visibility ?? VisibilityType.PUBLIC;
    rawPost.tags = this.getImportedTags(rawPost.tags, platformPost.tags ?? []);
    rawPost.createdBy = platformPost.importer;
    rawPost.isNSFW = Boolean(platformPost.NSFWTag);
    rawPost.NSFWTag = platformPost.NSFWTag;

    return rawPost;
  }

  getImportedTags(socialTags: string[], importedTags: string[]): string[] {
    if (!socialTags) socialTags = [];
    if (!importedTags) importedTags = [];

    const postTags = [...socialTags, ...importedTags]
      .map(tag => formatTag(tag))
      .filter(tag => Boolean(tag));

    return [...new Set(postTags)];
  }
}
