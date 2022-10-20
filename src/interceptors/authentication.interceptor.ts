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
import {
  Credential,
  RequestCreateNewUser,
  RequestCreateNewUserByEmail,
  RequestCreateNewUserByWallet,
  User,
  UserWithRelations,
  Wallet,
} from '../models';
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
import validator from 'validator';
import {RequestLoginByEmail} from '../models/request-login-by-email.model';
import {UserOtpwRepository} from '../repositories/user-otpw.repository';

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
    @repository(UserOtpwRepository)
    protected userOtpwRepository: UserOtpwRepository,
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

    if (methodName.startsWith(MethodType.SIGNUP)) {
      const {username} = invocationCtx.args[0] as RequestCreateNewUser;

      this.validateUsername(username);

      const foundUser = await this.userRepository.findOne({
        where: {username},
      });

      if (foundUser) {
        throw new HttpErrors.UnprocessableEntity('User already exists');
      }

      if (methodName === MethodType.SIGNUP) {
        const {address, network} = invocationCtx
          .args[0] as RequestCreateNewUserByWallet;
        const fixedAddress = isHex(`0x${address}`) ? `0x${address}` : address;

        const existingWallet = await this.walletRepository.exists(fixedAddress);

        if (existingWallet) {
          throw new HttpErrors.UnprocessableEntity(
            'Wallet address already exists',
          );
        }

        const existingNetwork = await this.networkRepository.exists(network);

        if (!existingNetwork) {
          throw new HttpErrors.UnprocessableEntity('Network not exists');
        }

        await this.validateWalletAddress(network, fixedAddress);

        invocationCtx.args[1] = new Wallet({
          id: fixedAddress,
          networkId: network,
          primary: true,
        });
      } else {
        const {email} = invocationCtx.args[0] as RequestCreateNewUserByEmail;

        if (!validator.isEmail(email))
          throw new HttpErrors.UnprocessableEntity('Invalid email address');
      }

      return;
    }

    if (
      methodName.startsWith(MethodType.LOGIN) ||
      methodName === MethodType.ADMINLOGIN
    ) {
      try {
        // Verify login process
        let user: User | UserWithRelations | undefined | null;

        if (
          methodName === MethodType.LOGIN ||
          methodName === MethodType.ADMINLOGIN
        ) {
          const credential = invocationCtx.args[0] as Credential;
          const {nonce, networkType} = credential;
          const [publicAddress, account] = credential.publicAddress.split('/');
          const nearAccount = isHex(`0x${account}`) ? `0x${account}` : account;

          if (nonce === 0 || !nonce) throw new Error('Invalid nonce!');

          const currentNetwork = await this.networkRepository.findById(
            networkType,
          );
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

          if (!wallet || !wallet.user) {
            throw new Error('Wallet address not exists!');
          }

          user = wallet.user;

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

          invocationCtx.args[1] = wallet.id;
        } else {
          const {otwp} = invocationCtx.args[0] as RequestLoginByEmail;

          const validOtpw = await this.userOtpwRepository.findOne({
            where: {
              id: otwp,
              expiredAt: {gt: new Date().toString()},
            },
          });

          user = await this.userRepository.findOne({
            where: {
              id: validOtpw?.userId,
            },
          });
        }

        if (!user) throw new Error('User not exists!');

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

        return;
      } catch (err) {
        throw new HttpErrors.Unauthorized(err.message);
      }
    }
  }

  async afterAuthenticate(
    invocationCtx: InvocationContext,
    result: AnyObject,
  ): Promise<void> {
    const methodName = invocationCtx.methodName as MethodType;

    if (methodName.startsWith(MethodType.SIGNUP)) {
      Promise.allSettled([
        this.userRepository.accountSetting(result.id).create({}),
        this.userRepository.notificationSetting(result.id).create({}),
        this.userRepository.languageSetting(result.id).create({}),
        this.metricService.countServerMetric(),
        this.friendService.defaultFriend(result.id),
        this.activityLogRepository.create({
          type: ActivityLogType.NEWUSER,
          userId: result.id,
          referenceId: result.id,
          referenceType: ReferenceType.USER,
        }),
      ]) as Promise<AnyObject>;

      if (methodName === MethodType.SIGNUP) {
        const wallet = invocationCtx.args[1] as Wallet;
        Promise.allSettled([
          this.userRepository.wallets(result.id).create(wallet),
          this.currencyService.addUserCurrencies(result.id, wallet.networkId),
          this.currencyService.sendMyriadReward(wallet),
        ]) as Promise<AnyObject>;
      }
    } else {
      if (
        methodName === MethodType.LOGIN ||
        methodName === MethodType.ADMINLOGIN
      ) {
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
          this.walletRepository.updateById(walletId, {
            primary: true,
            networkId,
          }),
        ]) as Promise<AnyObject>;
      } else {
        const {otwp} = invocationCtx.args[0] as RequestLoginByEmail;

        await this.userOtpwRepository.deleteById(otwp);
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
}
