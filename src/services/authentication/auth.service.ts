import {BindingScope, inject, injectable, service} from '@loopback/core';
import {
  Credential,
  RequestCreateNewUserByEmail,
  RequestCreateNewUserByWallet,
  RequestLoginByOTP,
  RequestLoginByPAT,
  RequestOTPByEmail,
  User,
  Wallet,
} from '../../models';
import isEmail from 'validator/lib/isEmail';
import {HttpErrors} from '@loopback/rest';
import {UserOTPService} from '../user-otp.service';
import {AnyObject, repository} from '@loopback/repository';
import {
  ActivityLogRepository,
  NetworkRepository,
  RequestCreateNewUserByEmailRepository,
  UserOTPRepository,
  UserPersonalAccessTokenRepository,
  UserRepository,
  WalletRepository,
} from '../../repositories';
import {assign, intersection} from 'lodash';
import {securityId, UserProfile} from '@loopback/security';
import {UserToken} from '../../interfaces';
import {TokenServiceBindings} from '../../keys';
import {JWTService} from './jwt.service';
import {isHex} from '@polkadot/util';
import {PolkadotJs} from '../../utils/polkadot-js';
import {generateObjectId} from '../../utils/formatter';
import {ActivityLogType, PermissionKeys, ReferenceType} from '../../enums';
import {config} from '../../config';
import {CurrencyService} from '../currency.service';
import {MetricService} from '../metric.service';
import {validateAccount} from '../../utils/validate-account';
import NonceGenerator from 'a-nonce-generator';

@injectable({scope: BindingScope.TRANSIENT})
export class AuthService {
  constructor(
    @repository(ActivityLogRepository)
    private activityLogRepository: ActivityLogRepository,
    @repository(RequestCreateNewUserByEmailRepository)
    private requestCreateNewUserByEmailRepository: RequestCreateNewUserByEmailRepository,
    @repository(NetworkRepository)
    private networkRepository: NetworkRepository,
    @repository(UserRepository)
    private userRepository: UserRepository,
    @repository(UserOTPRepository)
    private userOTPRepository: UserOTPRepository,
    @repository(WalletRepository)
    private walletRepository: WalletRepository,
    @repository(UserPersonalAccessTokenRepository)
    private userPersonalAccessTokenRepository: UserPersonalAccessTokenRepository,
    @service(CurrencyService)
    private currencyService: CurrencyService,
    @service(MetricService)
    private metricService: MetricService,
    @service(UserOTPService)
    private userOTPService: UserOTPService,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    private jwtService: JWTService,
  ) {}

  public async getNonce(id?: string, type?: string): Promise<{nonce: number}> {
    if (!id || !type) return {nonce: 0};

    switch (type) {
      case 'wallet':
        return this.walletRepository
          .user(id)
          .then(user => ({nonce: user.nonce}))
          .catch(() => ({nonce: 0}));

      case 'user':
        return this.userRepository
          .findById(id)
          .then(user => ({nonce: user.nonce}))
          .catch(() => ({nonce: 0}));

      default:
        return {nonce: 0};
    }
  }

  public async requestOTPByEmail(
    requestOTP: RequestOTPByEmail,
  ): Promise<{message: string}> {
    const {email: rawEmail, callbackURL} = requestOTP;
    const email = rawEmail.toLowerCase();

    if (!isEmail(email)) {
      throw new HttpErrors.UnprocessableEntity('InvalidEmailAddress');
    }

    await this.userOTPService.requestByEmail(email, callbackURL);

    return {message: `OTP sent to ${requestOTP.email}`};
  }

  public async signUpByEmail(
    requestCreateNewUserByEmail: RequestCreateNewUserByEmail,
  ): Promise<User> {
    const {
      name,
      username,
      email: rawEmail,
      callbackURL,
    } = requestCreateNewUserByEmail;

    this.validateUsername(username);

    const email = rawEmail.toLowerCase();
    const found = await this.userRepository.find({
      where: {
        or: [{email}, {username}],
      },
    });

    if (found.length > 0) {
      throw new HttpErrors.UnprocessableEntity(
        'Username/EmailAlreadyRegistered',
      );
    }

    if (!isEmail(email)) {
      throw new HttpErrors.UnprocessableEntity('Invalid email address');
    }

    const user = new User();
    user.id = generateObjectId();
    user.name = name.substring(0, 22);
    user.username = username;
    user.email = email;

    const currentUser: UserProfile = {
      [securityId]: user.id.toString(),
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
    };
    const {token} = await this.userOTPService.requestByEmail(
      email,
      callbackURL,
      currentUser,
    );
    const key = `sign-up/${token}`;
    await this.requestCreateNewUserByEmailRepository.set(key, user);
    await this.requestCreateNewUserByEmailRepository.expire(
      key,
      30 * 60 * 1000,
    );
    return user;
  }

  public async signUpByWallet(
    requestCreateNewUserByWallet: RequestCreateNewUserByWallet,
  ): Promise<User> {
    const {address, network, name, username} = requestCreateNewUserByWallet;

    this.validateUsername(username);

    const found = await this.userRepository.findOne({where: {username}});

    if (found) {
      throw new HttpErrors.UnprocessableEntity('UsernameAlreadyRegistered');
    }

    const fixedAddress = isHex(`0x${address}`) ? `0x${address}` : address;

    await this.validateWalletAddress(network, fixedAddress);

    const existingWallet = await this.walletRepository.exists(fixedAddress);

    if (existingWallet) {
      throw new HttpErrors.UnprocessableEntity('Wallet address already exists');
    }

    const existingNetwork = await this.networkRepository.findById(network);

    const user = new User();
    user.id = generateObjectId();
    user.name = name.substring(0, 22);
    user.username = username;
    user.permissions = this.getPermissions(fixedAddress);
    user.fullAccess = true;

    const wallet = new Wallet();
    wallet.id = fixedAddress;
    wallet.networkId = network;
    wallet.primary = true;
    wallet.blockchainPlatform = existingNetwork.blockchainPlatform;

    return this.userRepository
      .create(user)
      .then(result => {
        Promise.allSettled([
          this.userRepository.accountSetting(result.id).create({}),
          this.userRepository.notificationSetting(result.id).create({}),
          this.userRepository.languageSetting(result.id).create({}),
          this.metricService.countServerMetric(),
          this.activityLogRepository.create({
            type: ActivityLogType.NEWUSER,
            userId: result.id,
            referenceId: result.id,
            referenceType: ReferenceType.USER,
          }),
          this.userRepository.wallets(result.id).create(wallet),
          this.currencyService.create(result.id, wallet.networkId),
        ]) as Promise<AnyObject>;

        return result;
      })
      .catch(err => {
        throw err;
      });
  }

  public async loginByWallet(credential: Credential): Promise<UserToken> {
    const {nonce, networkType} = credential;
    const [publicAddress, account] = credential.publicAddress.split('/');
    const nearAccount = isHex(`0x${account}`) ? `0x${account}` : account;

    if (nonce === 0 || !nonce) {
      throw new HttpErrors.Unauthorized('Invalid nonce!');
    }

    if (!credential?.role) credential.role = 'user';

    const currentNetwork = await this.networkRepository.findById(networkType);
    const wallet = await this.walletRepository.findById(
      nearAccount ?? publicAddress,
      {
        include: ['user'],
      },
    );

    const user = wallet.user;

    if (!user) {
      throw new HttpErrors.Unauthorized('UserNotExists');
    }

    if (user.nonce !== nonce) {
      throw new HttpErrors.Unauthorized('Invalid nonce!');
    }

    const verified = await validateAccount(
      assign(credential, {publicAddress}),
      currentNetwork,
      wallet.id,
    );

    if (!verified) {
      throw new HttpErrors.Unauthorized('[auth] Failed to verified!');
    }

    if (credential.role === 'admin') {
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

    const userEmail = user.email ?? '';
    const userProfile: UserProfile = {
      [securityId]: user.id!.toString(),
      id: user.id,
      name: user.name,
      username: user.username,
      createdAt: user.createdAt,
      permissions: user.permissions,
    };

    const accessToken = await this.jwtService.generateToken(userProfile);
    const ng = new NonceGenerator();
    const newNonce = ng.generate();
    const jobs = [];

    jobs.push(
      this.userRepository.updateById(user.id, {
        nonce: newNonce,
        fullAccess: true,
      }),
    );

    if (credential.role === 'user') {
      await this.walletRepository.updateAll(
        {primary: false},
        {userId: user.id},
      );
      await this.currencyService.update(user.id, networkType);
      await this.walletRepository.updateById(wallet.id, {
        primary: true,
        networkId: networkType,
        blockchainPlatform: currentNetwork.blockchainPlatform,
      });
    }

    Promise.allSettled(jobs) as Promise<AnyObject>;

    return {
      user: {
        id: user.id.toString(),
        email: userEmail,
        username: user.username,
        address: wallet.id,
      },
      token: {
        accessToken,
      },
    };
  }

  public async loginByEmail(
    requestLogin: RequestLoginByOTP,
  ): Promise<UserToken> {
    const {token} = requestLogin;
    const validOTP = await this.userOTPService.verifyOTP(token);

    if (!validOTP) {
      throw new HttpErrors.Unauthorized('OTP invalid or expired!');
    }

    const key = `sign-up/${token}`;
    const newUser = await this.requestCreateNewUserByEmailRepository.get(key);

    let isNewUser = false;
    let user: User | null = null;

    if (newUser?.id === validOTP.userId.toString()) {
      const users = await this.userRepository.find({
        where: {
          or: [
            {email: newUser.email.toLowerCase()},
            {username: newUser.username},
          ],
        },
      });

      if (users.length > 0) {
        throw new HttpErrors.UnprocessableEntity('UserAlreadyExists');
      }

      user = await this.userRepository.create(newUser);
      isNewUser = Boolean(user);
    } else {
      user = await this.userRepository.findOne({
        where: {
          id: validOTP.userId,
        },
        include: [
          {
            relation: 'wallets',
            scope: {
              where: {
                blockchainPlatform: 'substrate',
              },
            },
          },
        ],
      });
    }

    if (!user) throw new HttpErrors.UnprocessableEntity('UserNotExists');

    const userProfile: UserProfile = {
      [securityId]: user.id!.toString(),
      id: user.id,
      name: user.name,
      username: user.username,
      createdAt: user.createdAt,
      permissions: user.permissions,
    };

    const userWallet = user.wallets?.[0]?.id ?? '';
    const accessToken = await this.jwtService.generateToken(userProfile);
    const jobs = [];

    if (isNewUser) {
      jobs.push(
        this.userRepository.accountSetting(user.id).create({}),
        this.userRepository.notificationSetting(user.id).create({}),
        this.userRepository.languageSetting(user.id).create({}),
        this.metricService.countServerMetric(),
        this.activityLogRepository.create({
          type: ActivityLogType.NEWUSER,
          userId: user.id,
          referenceId: user.id,
          referenceType: ReferenceType.USER,
        }),
      );
    }

    jobs.push(
      this.requestCreateNewUserByEmailRepository.delete(key),
      this.userOTPRepository.deleteAll({
        token: token,
      }),
    );

    Promise.allSettled(jobs) as Promise<AnyObject>;

    return {
      user: {
        id: user.id.toString(),
        email: user.email,
        username: user.username,
        address: userWallet,
      },
      token: {
        accessToken,
      },
    };
  }

  public async loginByPAT(requestLogin: RequestLoginByPAT): Promise<UserToken> {
    const {token} = requestLogin;
    let user: User | null = null;
    const validPAT = await this.userPersonalAccessTokenRepository.find({
      where: {
        description: 'Admin Personal Access Token',
        id: token,
      },
    });
    if (!validPAT) {
      throw new HttpErrors.Unauthorized('Personal Access Token is invalid!');
    }
    if (validPAT.length !== 1) {
      throw new HttpErrors.Unauthorized(
        'Personal Access Token is invalid. Please Revoke and Recreate!',
      );
    }
    user = await this.userRepository.findOne({
      where: {
        id: validPAT[0].userId,
      },
      include: [
        {
          relation: 'wallets',
          scope: {
            where: {
              blockchainPlatform: 'substrate',
            },
          },
        },
      ],
    });

    if (!user) throw new HttpErrors.UnprocessableEntity('UserNotExists');

    const userProfile: UserProfile = {
      [securityId]: user.id!.toString(),
      id: user.id,
      name: user.name,
      username: user.username,
      createdAt: user.createdAt,
      permissions: user.permissions,
    };

    const userWallet = user.wallets?.[0]?.id ?? '';
    const accessToken = await this.jwtService.generateToken(userProfile);

    return {
      user: {
        id: user.id.toString(),
        email: user.email,
        username: user.username,
        address: userWallet,
      },
      token: {
        accessToken,
      },
    };
  }

  private async validateWalletAddress(
    network: string,
    id: string,
  ): Promise<void> {
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

  private async validateNearAddress(id: string): Promise<void> {
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

  private validateUsername(username: string): void {
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

  private getPermissions(registeredAddress: string): PermissionKeys[] {
    const permissions: PermissionKeys[] = [PermissionKeys.USER];

    try {
      const {getKeyring, getHexPublicKey} = new PolkadotJs();
      const mnemonic = config.MYRIAD_ADMIN_SUBSTRATE_MNEMONIC;
      const serverAdmin = getKeyring().addFromMnemonic(mnemonic);
      const address = getHexPublicKey(serverAdmin);

      if (registeredAddress === address) {
        permissions.push(PermissionKeys.MASTER, PermissionKeys.ADMIN);
      }
    } catch {
      // ignore
    }

    return permissions;
  }
}
