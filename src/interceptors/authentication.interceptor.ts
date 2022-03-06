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
  BlockchainPlatform,
  MethodType,
  PermissionKeys,
  ReferenceType,
  WalletType,
} from '../enums';
import {Credential, UserWallet, Wallet} from '../models';
import {UserRepository, WalletRepository} from '../repositories';
import {ActivityLogService, CurrencyService, FriendService} from '../services';
import {numberToHex, hexToU8a} from '@polkadot/util';
import {signatureVerify} from '@polkadot/util-crypto';
import {securityId, UserProfile} from '@loopback/security';
import {assign, intersection} from 'lodash';
import NonceGenerator from 'a-nonce-generator';
import nacl from 'tweetnacl';

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
      const {name, username, ...wallet} = invocationCtx.args[0] as UserWallet;
      const foundWallet = await this.walletRepository.findOne({
        where: {id: wallet.walletAddress},
      });

      if (foundWallet)
        throw new HttpErrors.UnprocessableEntity(
          'Wallet address already exists',
        );

      const foundUser = await this.userRepository.findOne({
        where: {username},
      });

      if (foundUser)
        throw new HttpErrors.UnprocessableEntity('User already exists');

      this.validateWalletAddress(wallet.walletAddress);
      this.validateUsername(username);

      let walletPlatform: BlockchainPlatform;

      switch (wallet.walletType) {
        case WalletType.NEAR:
          walletPlatform = BlockchainPlatform.NEAR;
          break;

        case WalletType.METAMASK:
          walletPlatform = BlockchainPlatform.ETHEREUM;
          break;

        default:
          walletPlatform = BlockchainPlatform.SUBSTRATE;
      }

      invocationCtx.args[0] = Object.assign(invocationCtx.args[0], {
        name: name.substring(0, 22),
      });
      invocationCtx.args[1] = new Wallet({
        id: wallet.walletAddress,
        name: wallet.walletName,
        type: wallet.walletType,
        platform: walletPlatform,
        primary: true,
      });

      return;
    }

    try {
      // Verify login process
      const credential = invocationCtx.args[0] as Credential;
      const {nonce, walletType} = credential;
      const [publicAddress, nearAccount] = credential.publicAddress.split('/');

      if (nonce === 0 || !nonce) throw new Error('Invalid user!');

      const verified = this.validateAccount(
        assign(credential, {publicAddress}),
      );

      if (!verified) {
        throw new Error('Invalid user!');
      }

      const user = await this.walletRepository.user(
        nearAccount ?? publicAddress,
      );

      if (user.nonce !== nonce) {
        throw new Error('Invalid user!');
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
        walletType: walletType,
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
      Promise.allSettled([
        this.userRepository.accountSetting(result.id).create({}),
        this.userRepository.notificationSetting(result.id).create({}),
        this.userRepository.languageSetting(result.id).create({}),
        this.userRepository.wallets(result.id).create(wallet),
        this.currencyService.sendMyriadReward(result.id),
        this.currencyService.defaultCurrency(result.id),
        this.friendService.defaultFriend(result.id),
        this.activityLogService.createLog(
          ActivityLogType.NEWUSER,
          result.id,
          result.id,
          ReferenceType.USER,
        ),
      ]) as Promise<AnyObject>;
    } else {
      // Generate random nonce after login
      const {id} = invocationCtx.args[0].data;
      const ng = new NonceGenerator();
      const newNonce = ng.generate();

      await this.userRepository.updateById(id, {nonce: newNonce});
    }
  }

  validateWalletAddress(id: string): void {
    const environment = process.env.NODE_ENV ?? 'development';

    if (id.startsWith('0x')) {
      if (id.length !== 66) {
        throw new HttpErrors.UnprocessableEntity('Please a valid id');
      }
    } else {
      let nearId = null;
      let nearStatus = false;

      switch (environment) {
        case 'mainnet':
          nearStatus = id.endsWith('.near');
          nearId = id.split('.near')[0];
          break;

        default:
          nearStatus = id.endsWith('.testnet');
          nearId = id.split('.testnet')[0];
          break;
      }

      if (!nearStatus) {
        throw new HttpErrors.UnprocessableEntity('Invalid near id');
      }

      if (!nearId.match('^[a-z0-9_]+$')) {
        throw new HttpErrors.UnprocessableEntity(
          'Only allowed ascii letter (a-z), number (0-9), and underscore(_)',
        );
      }
    }
  }

  validateAccount(credential: Credential): boolean {
    const {nonce, signature, publicAddress, walletType} = credential;
    const publicKey = publicAddress.replace('0x', '');

    switch (walletType) {
      case WalletType.NEAR: {
        return nacl.sign.detached.verify(
          Buffer.from(numberToHex(nonce)),
          Buffer.from(hexToU8a(signature)),
          Buffer.from(publicKey, 'hex'),
        );
      }

      case WalletType.POLKADOT: {
        const {isValid} = signatureVerify(
          numberToHex(nonce),
          signature,
          publicAddress,
        );
        return isValid;
      }

      case WalletType.METAMASK: {
        return false;
      }

      default:
        return false;
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
