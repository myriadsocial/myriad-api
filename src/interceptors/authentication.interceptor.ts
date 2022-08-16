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
  NetworkRepository,
  UserRepository,
  WalletRepository,
} from '../repositories';
import {CurrencyService, FriendService, MetricService} from '../services';
import {securityId, UserProfile} from '@loopback/security';
import {assign, intersection} from 'lodash';
import NonceGenerator from 'a-nonce-generator';
import {validateAccount} from '../utils/validate-account';
import {PolkadotJs} from '../utils/polkadotJs-utils';
import {isHex} from '@polkadot/util';

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
    @repository(NetworkRepository)
    protected networkRepository: NetworkRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
    @service(CurrencyService)
    protected currencyService: CurrencyService,
    @service(FriendService)
    protected friendService: FriendService,
    @service(MetricService)
    protected metricService: MetricService,
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
      const {address, network} = wallet;
      const fixedAddress = isHex(`0x${address}`) ? `0x${address}` : address;
      const exist = await this.walletRepository.exists(fixedAddress);

      if (exist)
        throw new HttpErrors.UnprocessableEntity(
          'Wallet address already exists',
        );

      const existingNetwork = await this.networkRepository.exists(network);

      if (!existingNetwork) {
        throw new HttpErrors.UnprocessableEntity('Network not exists');
      }

      const foundUser = await this.userRepository.findOne({
        where: {username},
      });

      if (foundUser)
        throw new HttpErrors.UnprocessableEntity('User already exists');

      await this.validateWalletAddress(network, fixedAddress);

      this.validateUsername(username);

      Object.assign(invocationCtx.args[0], {
        name: name.substring(0, 22),
      });
      invocationCtx.args[1] = new Wallet({
        id: fixedAddress,
        networkId: network,
        primary: true,
      });

      return;
    }

    try {
      // Verify login process
      const credential = invocationCtx.args[0] as Credential;
      const {nonce, networkType} = credential;
      const [publicAddress, account] = credential.publicAddress.split('/');
      const nearAccount = isHex(`0x${account}`) ? `0x${account}` : account;

      if (nonce === 0 || !nonce) throw new Error('Invalid nonce!');

      const currentNetwork = await this.networkRepository.findById(networkType);
      const networks = await this.networkRepository.find({
        where: {blockchainPlatform: currentNetwork.blockchainPlatform},
      });
      const networkIds = networks.map(network => network.id);
      const wallet = await this.walletRepository.findOne({
        where: {
          id: nearAccount ?? publicAddress,
          networkId: {inq: networkIds},
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

      const verified = await validateAccount(
        assign(credential, {publicAddress}),
        currentNetwork,
        wallet.id,
        'auth',
      );

      if (!verified) {
        throw new Error('[auth] Failed to verified!');
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
      };

      invocationCtx.args[0].data = userProfile;
      invocationCtx.args[1] = wallet.id;

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
        this.currencyService.addUserCurrencies(result.id, wallet.networkId),
        this.userRepository.accountSetting(result.id).create({}),
        this.userRepository.notificationSetting(result.id).create({}),
        this.userRepository.languageSetting(result.id).create({}),
        this.userRepository.wallets(result.id).create(wallet),
        this.currencyService.sendMyriadReward(wallet.id, wallet.networkId),
        this.metricService.countServerMetric(),
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
      const [credential, walletId] = invocationCtx.args;
      const networkId = credential.networkType;
      const userId = credential.data.id;
      const ng = new NonceGenerator();
      const newNonce = ng.generate();

      await this.walletRepository.updateAll({primary: false}, {userId});
      await this.currencyService.updateUserCurrency(userId, networkId);
      Promise.allSettled([
        this.userRepository.updateById(userId, {nonce: newNonce}),
        this.walletRepository.updateById(walletId, {primary: true, networkId}),
      ]) as Promise<AnyObject>;
    }
  }

  async validateWalletAddress(network: string, id: string): Promise<void> {
    switch (network) {
      case 'near':
        return this.validateNearAddress(id);

      case 'ethereum': {
        if (id.length !== 42 && !isHex(id)) {
          throw new HttpErrors.UnprocessableEntity('Invalid ethereum address');
        }

        return;
      }
      default: {
        const polkadotJs = new PolkadotJs();
        const valid = polkadotJs.validatePolkadotAddress(id);

        if (id.length !== 66 && !valid) {
          throw new HttpErrors.UnprocessableEntity('Invalid polkadot address');
        }

        return;
      }
    }
  }

  async validateNearAddress(id: string): Promise<void> {
    if (isHex(id)) return;

    const nearNetwork = await this.networkRepository.findById('near');
    const environment = nearNetwork.rpcURL.split('.')[1];

    let nearId = '';
    let nearStatus = false;

    switch (environment) {
      case 'betanet':
        nearStatus = id.endsWith('.betanet');
        nearId = id.split('.betanet')[0];
        break;

      case 'testnet':
        nearStatus = id.endsWith('.testnet');
        nearId = id.split('.testnet')[0];
        break;

      default:
        nearStatus = id.endsWith('.near');
        nearId = id.split('.near')[0];
        break;
    }

    if (!nearStatus) {
      throw new HttpErrors.UnprocessableEntity('Invalid near id');
    }

    if (!nearId.match('^[a-z0-9_-]+$')) {
      throw new HttpErrors.UnprocessableEntity(
        'Only allowed ascii letter (a-z), number (0-9), dash(-) and underscore(_)',
      );
    }

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
