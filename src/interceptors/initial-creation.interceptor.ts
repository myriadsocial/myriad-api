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
import {ControllerType, LikeType, MethodType} from '../enums';
import {UsernameInfo} from '../models';
import {
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

    switch (methodName) {
      case MethodType.CREATE: {
        if (className === ControllerType.USER) {
          const newUser = invocationCtx.args[0];
          const user = await this.userRepository.findOne({
            where: {
              id: newUser.id,
            },
          });

          if (user) throw new HttpErrors.UnprocessableEntity('User already exist!');

          newUser.usernameInfo = new UsernameInfo({
            username:
              newUser.name.replace(/\s+/g, '').toLowerCase() +
              '.' +
              Math.random().toString(36).substr(2, 9),
            count: 0,
          });
          newUser.bio = `Hello, my name is ${newUser.name}!`;

          invocationCtx.args[0] = newUser;
          break;
        }

        if (className === ControllerType.TRANSACTION) {
          await this.currencyRepository.findById(invocationCtx.args[0].currencyId.toUpperCase());
          await this.userRepository.findById(invocationCtx.args[0].from);
          break;
        }

        break;
      }

      case MethodType.UPDATEBYID:
        invocationCtx.args[1].updatedAt = new Date().toString();
        break;
    }

    // Add pre-invocation logic here
    const result = await next();
    // Add post-invocation logic here
    switch (methodName) {
      case MethodType.CREATE: {
        if (className === ControllerType.USER) {
          this.currencyService.defaultCurrency(result.id) as Promise<void>;
          this.currencyService.defaultAcalaTips(result.id) as Promise<void>;
          break;
        }

        if (className === ControllerType.TRANSACTION) {
          this.currencyService.sendMyriadReward(result.from) as Promise<void>;
          break;
        }

        if (className === ControllerType.POST) {
          if (result.tags.length > 0) {
            this.tagService.createTags(result.tags) as Promise<void>;
          }
          break;
        }

        if (className === ControllerType.COMMENT) {
          const metric = await this.metricService.publicMetric(LikeType.POST, result.postId);
          this.postRepository.updateById(result.postId, {
            metric: metric,
          }) as Promise<void>;
          break;
        }

        break;
      }

      case MethodType.VERIFY: {
        this.currencyService.claimTips(result) as Promise<void>;
        break;
      }
    }

    return result;
  }
}
