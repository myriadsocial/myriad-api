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
import {Credential, User} from '../models';
import {UserRepository} from '../repositories';
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

    return result;
  }

  async beforeAuthenticate(invocationCtx: InvocationContext): Promise<void> {
    const methodName = invocationCtx.methodName as MethodType;

    if (methodName === MethodType.SIGNUP) {
      const {id, username} = invocationCtx.args[0];

      this.validateUsername(username);

      let user = await this.userRepository.findOne({where: {id}});

      if (user) throw new HttpErrors.UnprocessableEntity('User already exist!');

      user = new User(invocationCtx.args[0]);

      const name = user.name.substring(0, 22);

      user.name = name;

      invocationCtx.args[0] = user;

      return;
    }

    // Verify login process
    const {nonce, signature, publicAddress} = invocationCtx
      .args[0] as Credential;

    const {isValid} = signatureVerify(
      numberToHex(nonce),
      signature,
      publicAddress,
    );

    if (!isValid) {
      throw new HttpErrors.UnprocessableEntity('Invalid user!');
    }

    const user = await this.userRepository.findById(publicAddress);

    if (user.nonce !== nonce) {
      throw new HttpErrors.UnprocessableEntity('Invalid user!');
    }

    const userProfile: UserProfile = {
      [securityId]: user.id!.toString(),
      id: user.id,
      name: user.name,
      username: user.username,
      createdAt: user.createdAt,
    };

    invocationCtx.args[0].data = userProfile;

    return;
  }

  async afterAuthenticate(
    invocationCtx: InvocationContext,
    result: AnyObject,
  ): Promise<void> {
    const methodName = invocationCtx.methodName as MethodType;

    if (methodName === MethodType.SIGNUP) {
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

      return;
    }

    // Generate random nonce after login
    const {publicAddress} = invocationCtx.args[0];
    const ng = new NonceGenerator();
    const newNonce = ng.generate();

    await this.userRepository.updateById(publicAddress, {nonce: newNonce});

    return;
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
