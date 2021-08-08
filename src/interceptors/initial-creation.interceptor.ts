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
import {ControllerType, LikeType, MethodType, PlatformType} from '../enums';
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
    try {
      const methodName = invocationCtx.methodName;
      const className = invocationCtx.targetClass.name as ControllerType;

      switch (methodName) {
        case MethodType.CREATE: {
          invocationCtx.args[0].createdAt = new Date().toString();
          invocationCtx.args[0].updatedAt = new Date().toString();

          if (className === ControllerType.USER) {
            const user = await this.userRepository.findOne({
              where: {
                id: invocationCtx.args[0].id,
              },
            });

            if (user) throw new HttpErrors.UnprocessableEntity('User already exist!');

            invocationCtx.args[0].bio = `Hello, my name is ${invocationCtx.args[0].name}!`;
            break;
          }

          if (className === ControllerType.TRANSACTION) {
            invocationCtx.args[0].currencyId = invocationCtx.args[0].currencyId.toUpperCase();
            await this.currencyRepository.findById(invocationCtx.args[0].currencyId);
            await this.userRepository.findById(invocationCtx.args[0].from);
            break;
          }

          if (className === ControllerType.POST) {
            invocationCtx.args[0].platform = PlatformType.MYRIAD;
            invocationCtx.args[0].originCreatedAt = new Date().toString();

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
            this.postRepository.updateById(invocationCtx.args[0].postId, {
              metric: metric,
            });
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
    } catch (err) {
      throw new HttpErrors.UnprocessableEntity(err.message);
    }
  }
}
