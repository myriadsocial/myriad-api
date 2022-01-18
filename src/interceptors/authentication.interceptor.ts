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
import {ActivityLogType, MethodType, ReferenceType} from '../enums';
import {Credential, Wallet} from '../models';
import {UserRepository, WalletRepository} from '../repositories';
import {ActivityLogService, CurrencyService, FriendService} from '../services';
import {numberToHex} from '@polkadot/util';
import {signatureVerify} from '@polkadot/util-crypto';
import {securityId, UserProfile} from '@loopback/security';
import NonceGenerator from 'a-nonce-generator';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: AuthenticationInterceptor.BINDING_KEY}})
export class AuthenticationInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${AuthenticationInterceptor.name}`;

  constructor(
    @service(ActivityLogService)
    protected activityLogService: ActivityLogService,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
    @service(CurrencyService)
    protected currencyService: CurrencyService,
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
    await this.beforeAuthenticate(invocationCtx);

    const result = await next();

    await this.afterAuthenticate(invocationCtx, result);

    if (result.nonce) return {nonce: result.nonce};
    return result;
  }

  async beforeAuthenticate(invocationCtx: InvocationContext): Promise<void> {
    const methodName = invocationCtx.methodName as MethodType;

    if (methodName === MethodType.SIGNUP) {
      const {name, username, ...wallet} = invocationCtx.args[0];

      this.validateUsername(username);

      invocationCtx.args[0] = Object.assign(invocationCtx.args[0], {
        name: name.substring(0, 22),
      });
      invocationCtx.args[1] = new Wallet({
        id: wallet.walletAddress,
        name: wallet.walletName,
        type: wallet.walletType,
        platform: wallet.walletPlatform,
      });

      return;
    }

    try {
      // Verify login process
      const {nonce, signature, publicAddress} = invocationCtx
        .args[0] as Credential;

      if (nonce === 0 || !nonce) throw new Error('Invalid user!');

      const {isValid} = signatureVerify(
        numberToHex(nonce),
        signature,
        publicAddress,
      );

      if (!isValid) {
        throw new Error('Invalid user!');
      }

      const user = await this.walletRepository.user(publicAddress);

      if (user.nonce !== nonce) {
        throw new Error('Invalid user!');
      }

      const userProfile: UserProfile = {
        [securityId]: user.id!.toString(),
        id: user.id,
        name: user.name,
        username: user.username,
        createdAt: user.createdAt,
        walletAddress: publicAddress,
      };

      invocationCtx.args[0].data = userProfile;

      return;
    } catch (err) {
      throw new HttpErrors.Unauthorized(err.message);
    }
  }

  async afterAuthenticate(
    invocationCtx: InvocationContext,
    result: AnyObject,
  ): Promise<void> {
    const methodName = invocationCtx.methodName as MethodType;

    if (methodName === MethodType.SIGNUP) {
      const wallet = invocationCtx.args[1];

      await this.userRepository.accountSetting(result.id).create({});
      await this.userRepository.notificationSetting(result.id).create({});
      await this.userRepository.languageSetting(result.id).create({});
      await this.userRepository.wallets(result.id).create(wallet);
      await this.friendService.defaultFriend(result.id);
      await this.currencyService.defaultCurrency(result.id);
      await this.currencyService.sendMyriadReward(result.id);
      await this.activityLogService.createLog(
        ActivityLogType.NEWUSER,
        result.id,
        result.id,
        ReferenceType.USER,
      );

      return;
    }

    // Generate random nonce after login
    const {id} = invocationCtx.args[0].data;
    const ng = new NonceGenerator();
    const newNonce = ng.generate();

    await this.userRepository.updateById(id, {nonce: newNonce});

    return;
  }

  validateUsername(username: string): void {
    if (username[username.length - 1] === '_') {
      throw new HttpErrors.UnprocessableEntity(
        'Last character must be an ascii letter (a-z) or number (0-9)',
      );
    }

    if (username[0] === '_') {
      throw new HttpErrors.UnprocessableEntity(
        'Character must be start from an ascii letter (a-z) or number (0-9)',
      );
    }

    if (!username.match('^[a-z0-9_]+$')) {
      throw new HttpErrors.UnprocessableEntity(
        'Only allowed ascii letter (a-z), number (0-9), and underscore(_)',
      );
    }
  }
}
