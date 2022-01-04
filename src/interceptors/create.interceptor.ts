import {AuthenticationBindings} from '@loopback/authentication';
import {
  inject,
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
  ReportRepository,
  TransactionRepository,
  UserCurrencyRepository,
  UserReportRepository,
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
import {UserProfile, securityId} from '@loopback/security';
import {config} from '../config';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: CreateInterceptor.BINDING_KEY}})
export class CreateInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${CreateInterceptor.name}`;

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
    @repository(ReportRepository)
    protected reportRepository: ReportRepository,
    @repository(UserReportRepository)
    protected userReportRepository: UserReportRepository,
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
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    protected currentUser: UserProfile,
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

    if (methodName !== MethodType.CREATE) return next();

    let error = false;

    if (!this.currentUser) error = true;

    const isUser = await this.userRepository.findOne({
      where: {id: this.currentUser[securityId]},
    });

    if (!isUser) error = true;

    await this.beforeCreate(invocationCtx, error);

    let result = await next();

    result = await this.afterCreate(invocationCtx, result);

    return result;
  }

  async beforeCreate(
    invocationCtx: InvocationContext,
    error: boolean,
  ): Promise<void> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;
    const methodName = invocationCtx.methodName;

    switch (controllerName) {
      case ControllerType.AUTHENTICATION: {
        const {id, username} = invocationCtx.args[0];

        this.validateUsername(username);

        let user = await this.userRepository.findOne({where: {id}});

        if (user)
          throw new HttpErrors.UnprocessableEntity('User already exist!');

        user = new User(invocationCtx.args[0]);

        const name = user.name.substring(0, 22);

        user.name = name;

        invocationCtx.args[0] = user;
        return;
      }

      case ControllerType.TRANSACTION: {
        const userTransaction =
          invocationCtx.args[0].from === this.currentUser[securityId];

        if (error || !userTransaction) {
          throw new HttpErrors.Forbidden('Forbidden user!');
        }

        if (invocationCtx.args[0].from === invocationCtx.args[0].to) {
          throw new HttpErrors.UnprocessableEntity(
            'From and to address cannot be the same!',
          );
        }

        await this.currencyRepository.findById(
          invocationCtx.args[0].currencyId,
        );
        return;
      }

      case ControllerType.COMMENT: {
        const userComment =
          invocationCtx.args[0].userId === this.currentUser[securityId];

        if (error || !userComment) {
          throw new HttpErrors.Forbidden('Forbidden user!');
        }

        const {referenceId} = invocationCtx.args[0];

        await this.validateComment(referenceId);
        return;
      }

      case ControllerType.CURRENCY: {
        const currencyAdmin =
          this.currentUser[securityId] ===
          config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY;

        if (error || !currencyAdmin) {
          throw new HttpErrors.Forbidden('Forbidden user!');
        }

        invocationCtx.args[0].id = invocationCtx.args[0].id.toUpperCase();

        const currency = await this.currencyRepository.findOne({
          where: {id: invocationCtx.args[0].id},
        });

        if (currency)
          throw new HttpErrors.UnprocessableEntity('Currency already exists!');

        invocationCtx.args[0] =
          await this.currencyService.verifyRpcAddressConnection(
            invocationCtx.args[0],
          );

        return;
      }

      case ControllerType.FRIEND: {
        const {requestorId} = invocationCtx.args[0];

        if (error || this.currentUser[securityId] !== requestorId) {
          throw new HttpErrors.Forbidden('Forbidden user!');
        }

        return;
      }

      case ControllerType.USEREXPERIENCE: {
        const userId = invocationCtx.args[0];

        if (error || this.currentUser[securityId] !== userId) {
          throw new HttpErrors.Forbidden('Forbidden user!');
        }

        return;
      }

      case ControllerType.POST: {
        if (methodName === MethodType.IMPORT) {
          const userImport =
            invocationCtx.args[0].createdBy === this.currentUser[securityId];

          if (error || !userImport) {
            throw new HttpErrors.Forbidden('Forbidden user!');
          }

          return;
        }

        const userPost =
          invocationCtx.args[0].createdBy === this.currentUser[securityId];

        if (error || !userPost) {
          throw new HttpErrors.Forbidden('Forbidden user!');
        }

        return;
      }

      case ControllerType.TAG: {
        const tagAdmin =
          this.currentUser[securityId] ===
          config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY;

        if (error || !tagAdmin) {
          throw new HttpErrors.Forbidden('Forbidden user!');
        }

        return;
      }

      case ControllerType.USERCURRENCY: {
        const {userId, currencyId} = invocationCtx.args[0];

        const userCurrencyAdmin = this.currentUser[securityId] === userId;

        if (error || !userCurrencyAdmin) {
          throw new HttpErrors.Forbidden('Forbidden user!');
        }

        await this.currencyRepository.findById(currencyId);

        const {count} = await this.userCurrencyRepository.count({userId});

        invocationCtx.args[0].currencyId = currencyId;
        invocationCtx.args[0].priority = count + 1;

        return;
      }

      case ControllerType.USERSOCIALMEDIA: {
        const isUserSocialMedia =
          invocationCtx.args[0].publicKey === this.currentUser[securityId];

        if (error || !isUserSocialMedia) {
          throw new HttpErrors.Forbidden('Forbidden user!');
        }

        return;
      }

      case ControllerType.USERREPORT: {
        const userReport =
          this.currentUser[securityId] === invocationCtx.args[0];

        if (error || !userReport) {
          throw new HttpErrors.Forbidden('Forbidden user!');
        }

        return;
      }

      case ControllerType.VOTE: {
        const userVote =
          this.currentUser[securityId] === invocationCtx.args[0].userId;

        if (error || !userVote) {
          throw new HttpErrors.Forbidden('Forbidden user!');
        }

        return;
      }

      default:
        return;
    }
  }

  async afterCreate(
    invocationCtx: InvocationContext,
    result: AnyObject,
  ): Promise<AnyObject> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;

    switch (controllerName) {
      case ControllerType.AUTHENTICATION: {
        await this.userRepository.accountSetting(result.id).create({});
        await this.userRepository.notificationSetting(result.id).create({});
        await this.userRepository.languageSetting(result.id).create({});
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

      case ControllerType.USERREPORT: {
        const reportDetail = invocationCtx.args[1];

        const found = await this.userReportRepository.findOne({
          where: {
            reportId: result.id,
            reportedBy: invocationCtx.args[0],
          },
        });

        if (found)
          throw new HttpErrors.UnprocessableEntity(
            'You have report this user/post/comment',
          );

        await this.userReportRepository.create({
          referenceType: reportDetail.referenceType,
          description: reportDetail.description,
          reportedBy: invocationCtx.args[0],
          reportId: result.id,
        });

        const {count} = await this.userReportRepository.count({
          reportId: result.id.toString(),
        });

        await this.reportRepository.updateById(result.id, {
          totalReported: count,
          status: result.status,
        });

        return Object.assign(result, {totalReported: count});
      }

      default:
        return result;
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
