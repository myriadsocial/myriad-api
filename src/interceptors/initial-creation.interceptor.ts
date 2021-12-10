import {
  globalInterceptor,
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
  ControllerType,
  MethodType,
  PostStatus,
  PlatformType,
  ActivityLogType,
} from '../enums';
import {User} from '../models';
import {
  CommentRepository,
  CurrencyRepository,
  DraftPostRepository,
  PostRepository,
  TransactionRepository,
  UserCurrencyRepository,
  UserRepository,
} from '../repositories';
import {
  ActivityLogService,
  CurrencyService,
  FriendService,
  MetricService,
  NotificationService,
  TagService,
} from '../services';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@globalInterceptor('', {tags: {name: 'InitialCreation'}})
export class InitialCreationInterceptor implements Provider<Interceptor> {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(TransactionRepository)
    protected transactionRepository: TransactionRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @repository(UserCurrencyRepository)
    protected userCurrencyRepository: UserCurrencyRepository,
    @repository(DraftPostRepository)
    protected draftPostRepository: DraftPostRepository,
    @service(MetricService)
    protected metricService: MetricService,
    @service(CurrencyService)
    protected currencyService: CurrencyService,
    @service(TagService)
    protected tagService: TagService,
    @service(FriendService)
    protected friendService: FriendService,
    @service(NotificationService)
    protected notificationService: NotificationService,
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
    const methodName = invocationCtx.methodName;
    const className = invocationCtx.targetClass.name as ControllerType;

    if (methodName === MethodType.CREATE) {
      await this.beforeCreation(className, invocationCtx);
    }

    if (methodName === MethodType.UPDATEBYID) {
      invocationCtx.args[1].updatedAt = new Date().toString();

      if (className === ControllerType.USER) {
        await this.updateUserProfileActivityLog(
          invocationCtx.args[0],
          invocationCtx.args[1],
        );
      }

      return next();
    }

    if (methodName === MethodType.UPDATEEXPERIENCE) {
      invocationCtx.args[2].updatedAt = new Date().toString();
      return next();
    }

    if (methodName === MethodType.SELECTCURRENCY) {
      const userId = invocationCtx.args[0];
      const currencyId = invocationCtx.args[1];

      await this.currencyRepository.findById(currencyId);

      const userCurrency = await this.userCurrencyRepository.findOne({
        where: {userId, currencyId},
      });

      if (!userCurrency)
        throw new HttpErrors.UnprocessableEntity(
          "You don't have this currency",
        );

      return next();
    }

    let result = await next();

    if (methodName === MethodType.CREATE) {
      result = await this.afterCreation(className, result);
    }

    return result;
  }

  async beforeCreation(
    className: ControllerType,
    invocationCtx: InvocationContext,
  ): Promise<void> {
    switch (className) {
      case ControllerType.USER: {
        const newUser = new User(invocationCtx.args[0]);
        const user = await this.userRepository.findOne({
          where: {
            id: newUser.id,
          },
        });

        if (user)
          throw new HttpErrors.UnprocessableEntity('User already exist!');

        const flag = true;
        const name = newUser.name.substring(0, 22);
        const usernameBase = newUser.name
          .replace(/[^A-Za-z0-9]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .split(' ')[0]
          .toLowerCase();

        let username = usernameBase.substring(0, 16);

        while (flag) {
          const found = await this.userRepository.findOne({
            where: {
              username: username,
            },
          });

          let count = 2;

          if (found) {
            let newUsername = usernameBase + this.generateRandomCharacter();
            newUsername = newUsername.substring(0, 16);

            if (newUsername === found.username) {
              username =
                newUsername.substring(0, 16 - count) +
                this.generateRandomCharacter();
              username = username.substring(0, 16);
              count++;
            } else {
              username = newUsername;
            }
          } else break;
        }

        newUser.name = name;
        newUser.username = username;

        invocationCtx.args[0] = newUser;
        return;
      }

      case ControllerType.TRANSACTION: {
        if (invocationCtx.args[0].from === invocationCtx.args[0].to) {
          throw new HttpErrors.UnprocessableEntity(
            'From and to address cannot be the same!',
          );
        }

        await this.currencyRepository.findById(
          invocationCtx.args[0].currencyId,
        );
        await this.userRepository.findById(invocationCtx.args[0].from);
        return;
      }

      case ControllerType.COMMENT: {
        const {referenceId} = invocationCtx.args[0];
        await this.validateComment(referenceId);
        return;
      }

      default:
        return;
    }
  }

  async afterCreation(
    className: ControllerType,
    result: AnyObject,
  ): Promise<AnyObject> {
    switch (className) {
      case ControllerType.USER: {
        await this.userRepository.accountSetting(result.id).create({});
        await this.userRepository.notificationSetting(result.id).create({});
        await this.friendService.defaultFriend(result.id);
        await this.currencyService.defaultCurrency(result.id);
        await this.currencyService.defaultAcalaTips(result.id); // TODO: removed default acala tips
        return result;
      }

      case ControllerType.TRANSACTION: {
        await this.currencyService.sendMyriadReward(result.from);
        await this.activityLogService.userTipActivityLog(
          ActivityLogType.SENDTIP,
          result.from,
          result.id,
        );
        await this.metricService.userMetric(result.from);
        return result;
      }

      case ControllerType.POST: {
        if (result.status === PostStatus.PUBLISHED) {
          await this.draftPostRepository.deleteById(result.id);

          delete result.id;
          delete result.status;

          const newPost = await this.postRepository.create(
            Object.assign(result, {platform: PlatformType.MYRIAD}),
          );

          try {
            await this.notificationService.sendMention(
              newPost.createdBy,
              newPost.id,
              newPost.mentions ?? [],
            );
          } catch {
            // ignore
          }

          if (newPost.tags.length > 0) {
            await this.tagService.createTags(newPost.tags);
          }

          await this.activityLogService.userPostCommentActivityLog(
            ActivityLogType.CREATEPOST,
            newPost.createdBy,
            newPost.id,
          );

          await this.metricService.userMetric(newPost.createdBy);

          return newPost;
        }
        return result;
      }

      case ControllerType.COMMENT: {
        const post = await this.postRepository.findOne({
          where: {id: result.postId},
        });

        if (!post) return result;

        const metric = await this.metricService.publicMetric(
          result.type,
          result.referenceId,
          result.postId,
          result.section,
        );

        const popularCount = await this.metricService.countPopularPost(
          result.postId,
        );
        await this.postRepository.updateById(result.postId, {
          metric: Object.assign(post.metric, metric),
          popularCount: popularCount,
        });
        await this.activityLogService.userPostCommentActivityLog(
          ActivityLogType.CREATECOMMENT,
          result.userId,
          result.id,
        );
        await this.metricService.userMetric(result.userId);

        return result;
      }

      default:
        return result;
    }
  }

  async updateUserProfileActivityLog(
    userId: string,
    user: Partial<User>,
  ): Promise<void> {
    if (user.username) {
      this.validateUsername(user.username);

      await this.activityLogService.userProfileActivityLog(
        ActivityLogType.CREATEUSERNAME,
        userId,
      );
    }

    if (user.profilePictureURL) {
      await this.activityLogService.userProfileActivityLog(
        ActivityLogType.UPLOADPROFILEPICTURE,
        userId,
      );
    }

    if (user.bannerImageUrl) {
      await this.activityLogService.userProfileActivityLog(
        ActivityLogType.UPLOADBANNER,
        userId,
      );
    }

    if (user.bio) {
      await this.activityLogService.userProfileActivityLog(
        ActivityLogType.FILLBIO,
        userId,
      );
    }

    await this.metricService.userMetric(userId);
  }

  async validateComment(referenceId: string): Promise<void> {
    const lastComment = await this.commentRepository.findOne({
      where: {
        id: referenceId,
        type: ReferenceType.COMMENT,
      },
    });

    if (!lastComment) return;

    const comment = await this.commentRepository.findOne({
      where: {
        id: lastComment.referenceId,
        type: ReferenceType.COMMENT,
      },
    });

    if (!comment) return;
    throw new HttpErrors.UnprocessableEntity('Cannot added comment anymore');
  }

  generateRandomCharacter(): string {
    const randomCharOne = Math.random().toString(36).substring(2);
    const randomCharTwo = Math.random().toString(36).substring(2);

    return '.' + randomCharOne + randomCharTwo;
  }

  validateUsername(username: string): void {
    if (
      username[username.length - 1] === '.' ||
      username[username.length - 1] === '_'
    ) {
      throw new HttpErrors.UnprocessableEntity(
        'Last character must be an ascii letter (a-z) or number (0-9)',
      );
    }

    if (username[0] === '.' || username[0] === '_') {
      throw new HttpErrors.UnprocessableEntity(
        'Character must be start from an ascii letter (a-z) or number (0-9)',
      );
    }

    if (username.includes('.') && username.includes('_')) {
      throw new HttpErrors.UnprocessableEntity(
        'Only allowed ascii letter (a-z), number (0-9), and periods(.)/underscore(_)',
      );
    }

    if (!username.match('^[a-z0-9._]+$')) {
      throw new HttpErrors.UnprocessableEntity(
        'Only allowed ascii letter (a-z), number (0-9), and periods(.)/underscore(_)',
      );
    }
  }
}
