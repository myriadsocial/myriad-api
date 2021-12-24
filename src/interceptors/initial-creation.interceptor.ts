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
import {User, Wallet} from '../models';
import {
  CommentRepository,
  CurrencyRepository,
  DraftPostRepository,
  PostRepository,
  TransactionRepository,
  UserCurrencyRepository,
  UserRepository,
  WalletRepository,
} from '../repositories';
import {
  ActivityLogService,
  CurrencyService,
  FriendService,
  MetricService,
  NotificationService,
  TagService,
} from '../services';
import {BcryptHasher} from '../services/authentication/hash.password.service';

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
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
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

    let wallet = null;

    if (methodName === MethodType.CREATE) {
      wallet = await this.beforeCreation(className, invocationCtx);
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
      result = await this.afterCreation(className, result, wallet);
    }

    return result;
  }

  async beforeCreation(
    className: ControllerType,
    invocationCtx: InvocationContext,
  ): Promise<Wallet | null> {
    switch (className) {
      case ControllerType.USER: {
        const {name, username, ...wallet} = invocationCtx.args[0];

        this.validateUsername(username);

        const found = await this.walletRepository.findOne({
          where: {id: wallet.walletAddress},
        });

        if (found)
          throw new HttpErrors.UnprocessableEntity('Address already exist!');

        invocationCtx.args[0] = Object.assign(invocationCtx.args[0], {
          name: name.substring(0, 22),
        });

        const {walletName, walletAddress, walletType, walletPlatform} = wallet;

        return new Wallet({
          id: walletAddress,
          name: walletName,
          type: walletType,
          platform: walletPlatform,
        });
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

        const wallet = await this.walletRepository.findById(
          invocationCtx.args[0].from,
        );
        await this.userRepository.findById(wallet.userId);
        return null;
      }

      case ControllerType.COMMENT: {
        const {referenceId} = invocationCtx.args[0];
        await this.validateComment(referenceId);
        return null;
      }

      case ControllerType.USERWALLET: {
        await this.userRepository.findById(invocationCtx.args[0]);

        const {id} = invocationCtx.args[1];
        const found = await this.walletRepository.findOne({where: {id}});

        if (found) {
          throw new HttpErrors.UnprocessableEntity('Wallet already exists!');
        }
        return null;
      }

      default:
        return null;
    }
  }

  async afterCreation(
    className: ControllerType,
    result: AnyObject,
    wallet?: Wallet | null,
  ): Promise<AnyObject> {
    switch (className) {
      case ControllerType.USER: {
        //TODO: override the default create() method and move password auto-generation there
        if (!wallet) return result;

        const hasher = new BcryptHasher();
        const password = await hasher.hashPassword(result.id + wallet.id);

        await this.userRepository.updateById(result.id, {password});
        await this.userRepository.wallets(result.id).create(wallet);
        await this.userRepository.accountSetting(result.id).create({});
        await this.userRepository.notificationSetting(result.id).create({});
        await this.userRepository.leaderboard(result.id).create({});
        await this.friendService.defaultFriend(result.id);
        await this.currencyService.defaultCurrency(result.id);
        await this.currencyService.sendMyriadReward(result.id);
        await this.activityLogService.createLog(
          ActivityLogType.NEWUSER,
          result.id,
          result.id,
          ReferenceType.USER,
        );

        return result;
      }

      case ControllerType.TRANSACTION: {
        await this.activityLogService.createLog(
          ActivityLogType.SENDTIP,
          result.from,
          result.id,
          ReferenceType.TRANSACTION,
        );
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

          await this.activityLogService.createLog(
            ActivityLogType.CREATEPOST,
            newPost.createdBy,
            newPost.id,
            ReferenceType.POST,
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
        await this.activityLogService.createLog(
          ActivityLogType.CREATECOMMENT,
          result.userId,
          result.id,
          ReferenceType.COMMENT,
        );

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
      throw new HttpErrors.UnprocessableEntity('Cannot update username');
    }

    if (user.profilePictureURL) {
      await this.activityLogService.createLog(
        ActivityLogType.UPLOADPROFILEPICTURE,
        userId,
        userId,
        ReferenceType.USER,
      );
    }

    if (user.bannerImageUrl) {
      await this.activityLogService.createLog(
        ActivityLogType.UPLOADBANNER,
        userId,
        userId,
        ReferenceType.USER,
      );
    }

    if (user.bio) {
      await this.activityLogService.createLog(
        ActivityLogType.FILLBIO,
        userId,
        userId,
        ReferenceType.USER,
      );
    }
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
