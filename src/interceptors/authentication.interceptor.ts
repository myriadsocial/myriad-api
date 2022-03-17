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
import {
  ActivityLogType,
  MethodType,
  PermissionKeys,
  ReferenceType,
} from '../enums';
import {Credential, UserWallet, Wallet} from '../models';
import {
  ActivityLogRepository,
  UserRepository,
  WalletRepository,
} from '../repositories';
import {CurrencyService, FriendService} from '../services';
import {securityId, UserProfile} from '@loopback/security';
import {assign, intersection} from 'lodash';
import NonceGenerator from 'a-nonce-generator';
import {validateAccount} from '../utils/validate-account';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: AuthenticationInterceptor.BINDING_KEY}})
export class AuthenticationInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${AuthenticationInterceptor.name}`;

  constructor(
    @repository(ActivityLogRepository)
    protected activityLogRepository: ActivityLogRepository,
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
      const {name, username, ...wallet} = invocationCtx.args[0] as UserWallet;
      const exist = await this.walletRepository.exists(wallet.address);

      if (exist)
        throw new HttpErrors.UnprocessableEntity(
          'Wallet address already exists',
        );

      const foundUser = await this.userRepository.findOne({
        where: {username},
      });

      if (foundUser)
        throw new HttpErrors.UnprocessableEntity('User already exists');

      this.validateWalletAddress(wallet.address);
      this.validateUsername(username);

      invocationCtx.args[0] = Object.assign(invocationCtx.args[0], {
        name: name.substring(0, 22),
      });
      invocationCtx.args[1] = new Wallet({
        id: wallet.address,
        type: wallet.type,
        network: wallet.network,
        networks: [wallet.network],
        primary: true,
      });

      return;
    }

    try {
      // Verify login process
      const credential = invocationCtx.args[0] as Credential;
      const {nonce, networkType} = credential;
      const [publicAddress, nearAccount] = credential.publicAddress.split('/');

      if (nonce === 0 || !nonce) throw new Error('Invalid nonce!');

      const wallet = await this.walletRepository.findOne({
        where: {
          id: nearAccount ?? publicAddress,
          networks: {inq: [[networkType]]},
        },
        include: ['user'],
      });

      const user = wallet?.user;

      if (!user) {
        throw new Error('Wallet address not exists!');
      }

      if (user.nonce !== nonce) {
        throw new Error('Invalid nonce!');
      }

      const verified = validateAccount(assign(credential, {publicAddress}));

      if (!verified) {
        throw new Error('Failed to verified!');
      }

      if (methodName === MethodType.ADMINLOGIN) {
        const [permission] = intersection(user.permissions, [
          PermissionKeys.ADMIN,
        ]);

        if (permission !== PermissionKeys.ADMIN) {
          throw new HttpErrors.Forbidden('Invalid admin');
        }
      } else {
        const [userPermission] = intersection(user.permissions, [
          PermissionKeys.USER,
        ]);

        if (userPermission !== PermissionKeys.USER) {
          throw new HttpErrors.Forbidden('Invalid user');
        }
      }

      const userProfile: UserProfile = {
        [securityId]: user.id!.toString(),
        id: user.id,
        name: user.name,
        username: user.username,
        createdAt: user.createdAt,
        permissions: user.permissions,
        publicAddress: wallet.id,
        network: networkType,
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
      const wallet = invocationCtx.args[1] as Wallet;
      Promise.allSettled([
        this.userRepository.accountSetting(result.id).create({}),
        this.userRepository.notificationSetting(result.id).create({}),
        this.userRepository.languageSetting(result.id).create({}),
        this.userRepository.wallets(result.id).create(wallet),
        this.currencyService.sendMyriadReward(wallet.id),
        this.currencyService.defaultCurrency(result.id),
        this.friendService.defaultFriend(result.id),
        this.activityLogRepository.create({
          type: ActivityLogType.NEWUSER,
          userId: result.id,
          referenceId: result.id,
          referenceType: ReferenceType.USER,
        }),
      ]) as Promise<AnyObject>;
    } else {
      // Generate random nonce after login
      const {id, publicAddress, network} = invocationCtx.args[0].data;
      const ng = new NonceGenerator();
      const newNonce = ng.generate();

      await this.userRepository.updateById(id, {nonce: newNonce});
      await this.walletRepository.updateById(publicAddress, {
        primary: true,
        network,
      });
    }
  }

  validateWalletAddress(id: string): void {
    if (id.length === 66) {
      if (!id.startsWith('0x')) {
        throw new HttpErrors.UnprocessableEntity('Invalid polkadot address');
      }

      return;
    } else if (id.length === 42) {
      if (!id.startsWith('0x')) {
        throw new HttpErrors.UnprocessableEntity('Invalid ethereum address');
      }

      return;
    } else {
      let nearId = '';
      let nearStatus = false;

      if (id.endsWith('.near')) {
        nearId = id.split('.near')[0];
        nearStatus = true;
      } else if (id.endsWith('.testnet')) {
        nearId = id.split('.testnet')[0];
        nearStatus = true;
      }

      if (!nearStatus) {
        throw new HttpErrors.UnprocessableEntity('Invalid near id');
      }

      if (!nearId.match('^[a-z0-9_-]+$')) {
        throw new HttpErrors.UnprocessableEntity(
          'Only allowed ascii letter (a-z), number (0-9), dash(-) and underscore(_)',
        );
      }
    }
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
