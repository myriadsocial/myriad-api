import {
  globalInterceptor,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  service,
  ValueOrPromise,
} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {CommentType, ControllerType, LikeType, MethodType} from '../enums';
import {
  CommentRepository,
  CurrencyRepository,
  PostRepository,
  TransactionRepository,
  UserRepository,
} from '../repositories';
import {CurrencyService, MetricService, TagService} from '../services';

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
    @service(MetricService)
    protected metricService: MetricService,
    @service(CurrencyService)
    protected currencyService: CurrencyService,
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
  async intercept(invocationCtx: InvocationContext, next: () => ValueOrPromise<InvocationResult>) {
    const methodName = invocationCtx.methodName;
    const className = invocationCtx.targetClass.name as ControllerType;

    if (methodName === MethodType.CREATE) {
      await this.beforeCreation(className, invocationCtx);
    }

    if (methodName === MethodType.UPDATEBYID) {
      invocationCtx.args[1].updatedAt = new Date().toString();
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

  async beforeCreation(className: ControllerType, invocationCtx: InvocationContext): Promise<void> {
    switch (className) {
      case ControllerType.USER: {
        const newUser = invocationCtx.args[0];
        const user = await this.userRepository.findOne({
          where: {
            id: newUser.id,
          },
        });

        if (user) throw new HttpErrors.UnprocessableEntity('User already exist!');

        newUser.bio = `Hello, my name is ${newUser.name}!`;
        newUser.username =
          newUser.name.replace(/\s+/g, '').toLowerCase() +
          '.' +
          Math.random().toString(36).substr(2, 9);

        invocationCtx.args[0] = newUser;
        return;
      }

      case ControllerType.TRANSACTION: {
        await this.currencyRepository.findById(invocationCtx.args[0].currencyId.toUpperCase());
        await this.userRepository.findById(invocationCtx.args[0].from);
        return;
      }

      case ControllerType.POSTCOMMENT: {
        invocationCtx.args[1] = Object.assign(invocationCtx.args[1], {
          type: CommentType.POST,
          referenceId: invocationCtx.args[0],
        });
        return;
      }

      case ControllerType.COMMENTCOMMENT: {
        await this.validateComment(invocationCtx.args[0]);
        invocationCtx.args[1] = Object.assign(invocationCtx.args[1], {
          type: CommentType.COMMENT,
          referenceId: invocationCtx.args[0],
        });
        return;
      }

      default:
        return;
    }
  }

  /* eslint-disable  @typescript-eslint/no-explicit-any */
  async afterCreation(className: ControllerType, result: any): Promise<void> {
    switch (className) {
      case ControllerType.USER: {
        await this.currencyService.defaultCurrency(result.id);
        await this.currencyService.defaultAcalaTips(result.id);
        return;
      }

      case ControllerType.TRANSACTION: {
        await this.currencyService.sendMyriadReward(result.from);
        return;
      }

      case ControllerType.POST: {
        if (result.tags.length === 0) return;
        await this.tagService.createTags(result.tags);
        return;
      }

      case ControllerType.POSTCOMMENT:
      case ControllerType.COMMENTCOMMENT:
      case ControllerType.COMMENT: {
        const metric = await this.metricService.publicMetric(LikeType.POST, result.postId);
        await this.postRepository.updateById(result.postId, {
          metric: metric,
        });
        return;
      }
    }
  }

  async validateComment(referenceId: string): Promise<void> {
    const lastComment = await this.commentRepository.findOne({
      where: {
        id: referenceId,
        type: CommentType.COMMENT,
      },
    });

    if (!lastComment) return;

    const comment = await this.commentRepository.findOne({
      where: {
        id: lastComment.referenceId,
        type: CommentType.COMMENT,
      },
    });

    if (!comment) return;
    throw new HttpErrors.UnprocessableEntity('Cannot added comment anymore');
  }
}
