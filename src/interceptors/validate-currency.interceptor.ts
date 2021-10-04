import {
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  ValueOrPromise,
} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {ApiPromise} from '@polkadot/api';
import {ControllerType, MethodType} from '../enums';
import {
  CurrencyRepository,
  UserCurrencyRepository,
  UserRepository,
} from '../repositories';
import {PolkadotJs} from '../utils/polkadotJs-utils';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: ValidateCurrencyInterceptor.BINDING_KEY}})
export class ValidateCurrencyInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${ValidateCurrencyInterceptor.name}`;

  constructor(
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
    @repository(UserCurrencyRepository)
    protected userCurrencyRepository: UserCurrencyRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
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
    const className = invocationCtx.targetClass.name as ControllerType;
    const methodName = invocationCtx.methodName;

    switch (className) {
      case ControllerType.USERCURRENCY: {
        const {userId, currencyId} = invocationCtx.args[0];

        if (methodName === MethodType.DELETE) {
          const user = await this.userRepository.findById(userId);

          if (user.defaultCurrency === currencyId)
            throw new HttpErrors.UnprocessableEntity(
              'Please changed your default currency, before deleting it',
            );
        }

        if (methodName === MethodType.CREATE) {
          await this.currencyRepository.findById(currencyId.toUpperCase());

          // Check if user already has the crypto
          const userCurrency = await this.userCurrencyRepository.findOne({
            where: {
              userId,
              currencyId: currencyId.toUpperCase(),
            },
          });

          if (userCurrency) {
            throw new HttpErrors.UnprocessableEntity(
              'You already have this token',
            );
          }
        }

        break;
      }

      case ControllerType.CURRENCY: {
        invocationCtx.args[0].id = invocationCtx.args[0].id.toUpperCase();

        const currency = await this.currencyRepository.findOne({
          where: {id: invocationCtx.args[0].id},
        });

        if (currency)
          throw new HttpErrors.UnprocessableEntity('Currency already exists!');

        let native = false;
        let api: ApiPromise;

        const {id, rpcURL, types} = invocationCtx.args[0];

        const {polkadotApi, getSystemParameters} = new PolkadotJs();

        try {
          api = await polkadotApi(rpcURL, types);
        } catch (err) {
          throw new HttpErrors.UnprocessableEntity('Connection failed!');
        }

        const {symbols, symbolsDecimals} = await getSystemParameters(api);
        const currencyId = symbols.find(e => e === id.toUpperCase());

        if (!currencyId) throw new HttpErrors.NotFound('Currency not found!');

        if (currencyId === symbols[0]) native = true;

        invocationCtx.args[0] = Object.assign(invocationCtx.args[0], {
          id: currencyId,
          decimal: symbolsDecimals[currencyId],
          native,
        });

        await api.disconnect();

        break;
      }
    }

    // Add pre-invocation logic here
    const result = await next();
    // Add post-invocation logic here
    return result;
  }
}
