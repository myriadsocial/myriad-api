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
import {ReferenceType, ControllerType, MethodType} from '../enums';
import {
  CommentRepository,
  CurrencyRepository,
  LikeRepository,
  PostRepository,
  TransactionRepository,
  UserCurrencyRepository,
  UserRepository,
} from '../repositories';
import {
  CurrencyService,
  FriendService,
  MetricService,
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
    @repository(LikeRepository)
    protected likeRepository: LikeRepository,
    @repository(UserCurrencyRepository)
    protected userCurrencyRepository: UserCurrencyRepository,
    @service(MetricService)
    protected metricService: MetricService,
    @service(CurrencyService)
    protected currencyService: CurrencyService,
    @service(TagService)
    protected tagService: TagService,
    @service(FriendService)
    protected friendService: FriendService,
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

    const result = await next();

    if (methodName === MethodType.CREATE) {
      this.afterCreation(className, result) as Promise<void>;
    }

    if (methodName === MethodType.VERIFY) {
      this.currencyService.claimTips(result) as Promise<void>;
    }

    return result;
  }

  async beforeCreation(
    className: ControllerType,
    invocationCtx: InvocationContext,
  ): Promise<void> {
    switch (className) {
      case ControllerType.USER: {
        const newUser = invocationCtx.args[0];
        const user = await this.userRepository.findOne({
          where: {
            id: newUser.id,
          },
        });

        if (user)
          throw new HttpErrors.UnprocessableEntity('User already exist!');

        const flag = true;
        const usernameBase = newUser.name
          .replace(/\s+/g, '')
          .toLowerCase()
          .substring(0, 16);

        let newUsername = usernameBase;

        while (flag) {
          const found = await this.userRepository.findOne({
            where: {
              username: newUsername,
            },
          });

          if (found) {
            newUsername =
              usernameBase.substring(0, 6) +
              '.' +
              Math.random().toString(36).substr(2, 9);
          } else {
            newUser.username = newUsername;
            break;
          }
        }

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
  ): Promise<void> {
    switch (className) {
      case ControllerType.USER: {
        await this.userRepository.accountSetting(result.id).create({});
        await this.userRepository.notificationSetting(result.id).create({});
        await this.friendService.defaultFriend(result.id);
        await this.currencyService.defaultCurrency(result.id);
        await this.currencyService.defaultAcalaTips(result.id); // TODO: removed default acala tips
        return;
      }

      case ControllerType.TRANSACTION: {
        await this.currencyService.sendMyriadReward(result.from);
        return;
      }

      case ControllerType.POST: {
        await this.metricService.userMetric(result.createdBy);
        if (result.tags.length === 0) return;
        await this.tagService.createTags(result.tags);
        return;
      }

      case ControllerType.COMMENT: {
        const post = await this.postRepository.findOne({
          where: {id: result.postId},
        });

        if (!post) return;

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

        return;
      }
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
}
