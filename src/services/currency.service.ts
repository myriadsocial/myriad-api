import {BindingScope, service, injectable, inject} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {ApiPromise} from '@polkadot/api';
import {config} from '../config';
import {ActivityLogType, ReferenceType} from '../enums';
import {PaymentInfo} from '../interfaces';
import {
  ActivityLogRepository,
  CurrencyRepository,
  QueueRepository,
  TransactionRepository,
  UserCurrencyRepository,
  UserSocialMediaRepository,
  WalletRepository,
} from '../repositories';
import {PolkadotJs} from '../utils/polkadotJs-utils';
import {HttpErrors} from '@loopback/rest';
import {BcryptHasher} from './authentication/hash.password.service';
import {NotificationService} from './notification.service';
import {JWTService} from './authentication';
import {TokenServiceBindings} from '../keys';
import {BN} from '@polkadot/util';
import {parseJSON} from '../utils/formated-balance';
import {UserCurrency} from '../models';

@injectable({scope: BindingScope.TRANSIENT})
export class CurrencyService {
  constructor(
    @repository(ActivityLogRepository)
    protected activityLogRepository: ActivityLogRepository,
    @repository(CurrencyRepository)
    public currencyRepository: CurrencyRepository,
    @repository(UserSocialMediaRepository)
    protected userSocialMediaRepository: UserSocialMediaRepository,
    @repository(TransactionRepository)
    protected transactionRepository: TransactionRepository,
    @repository(QueueRepository)
    protected queueRepository: QueueRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
    @repository(UserCurrencyRepository)
    protected userCurrencyRepository: UserCurrencyRepository,
    @service(NotificationService)
    protected notificationService: NotificationService,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    protected jwtService: JWTService,
  ) {}

  async addUserCurrencies(userId: string, networkId: string): Promise<void> {
    const currencies = await this.currencyRepository.find({
      where: {networkId},
      order: ['native DESC'],
    });

    await Promise.all(
      currencies.map(async (currency, index) => {
        return this.userCurrencyRepository.create({
          userId: userId,
          networkId: networkId,
          currencyId: currency.id,
          priority: index + 1,
        });
      }),
    );
  }

  async updateUserCurrency(userId: string, networkId: string): Promise<void> {
    if (!userId || !networkId) return;

    const {count: countCurrency} = await this.currencyRepository.count({
      networkId: networkId,
    });

    let {count: countUserCurrency} = await this.userCurrencyRepository.count({
      networkId: networkId,
      userId: userId,
    });

    if (countUserCurrency === 0) {
      await this.addUserCurrencies(userId, networkId);
      countUserCurrency = countCurrency;
    }

    if (countCurrency > countUserCurrency) {
      const userCurrencies = await this.userCurrencyRepository.find({
        where: {
          networkId: networkId,
          userId: userId,
        },
      });
      const currencyIds = userCurrencies.map(
        userCurrency => userCurrency.currencyId,
      );
      const currencies = await this.currencyRepository.find({
        where: {
          id: {nin: currencyIds},
          networkId: networkId,
        },
      });

      const newUserCurrencies: UserCurrency[] = [];

      for (let i = 0; i < currencies.length; i++) {
        const newUserCurrency = new UserCurrency({
          userId: userId,
          networkId: networkId,
          currencyId: currencies[i].id,
          priority: countUserCurrency + 1 + i,
        });

        newUserCurrencies.push(newUserCurrency);
      }

      await this.userCurrencyRepository.createAll(newUserCurrencies);
    }
  }

  async sendMyriadReward(address: string): Promise<void> {
    if (!address.startsWith('0x') && address.length !== 66) return;
    if (!config.MYRIAD_REWARD_AMOUNT) return;
    if (config.MYRIAD_REWARD_AMOUNT === 0) return;

    try {
      const currency = await this.currencyRepository.findOne({
        where: {
          networkId: 'myriad',
          symbol: 'MYRIA',
        },
        include: ['network'],
      });

      if (!currency || !currency.network) return;
      const {
        id,
        decimal,
        network: {rpcURL},
      } = currency;
      const {polkadotApi, getKeyring} = new PolkadotJs();
      const api = await polkadotApi(rpcURL);

      const mnemonic = config.MYRIAD_FAUCET_MNEMONIC;
      const from = getKeyring().addFromMnemonic(mnemonic);
      const to = address;

      const rewardAmount = config.MYRIAD_REWARD_AMOUNT * 10 ** decimal;

      const transfer = api.tx.balances.transfer(
        to,
        new BN(rewardAmount.toString()),
      );
      const {nonce} = await api.query.system.account(from.address);
      const getNonce = await this.getQueueNumber(nonce.toJSON(), 'MYRIA');

      const hash = await new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        transfer.signAndSend(from, {nonce: getNonce}, ({status, isError}) => {
          if (status.isFinalized) {
            const blockHash = status.asFinalized.toHex();
            resolve(blockHash);
          } else if (isError) {
            reject();
          }
        });
      });

      await api.disconnect();

      if (hash && typeof hash === 'string') {
        const transaction = await this.transactionRepository.create({
          hash: hash,
          amount: rewardAmount / 10 ** decimal,
          to: to,
          from: config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY,
          currencyId: id,
        });

        await this.notificationService.sendInitialTips(transaction);
      }
    } catch {
      // ignore
    }
  }

  // Manually claimmed
  async claimTips(userId: string, currencyId: string): Promise<void> {
    const {id, decimal, native, network, symbol} =
      await this.currencyRepository.findById(currencyId, {
        include: ['network'],
      });

    if (!network) return;
    if (network.id !== 'myriad') return;

    const {getKeyring, getHexPublicKey} = new PolkadotJs();
    const {rpcURL, types} = network;
    const hasher = new BcryptHasher();
    const userSocialMedias = await this.userSocialMediaRepository.find({
      where: {userId: userId},
      include: ['people'],
    });
    const people = userSocialMedias.map(e => e.people);
    const to = userId; // TODO: change to polkadot
    const typesBundle = parseJSON(types);
    const api = await this.connect(rpcURL, typesBundle);

    for (const person of people) {
      if (!person) continue;

      const {
        id: peopleId,
        originUserId,
        platform,
        createdAt,
        walletAddressPassword: storedPassword,
      } = person;

      if (!storedPassword) continue;

      const password = peopleId + config.MYRIAD_ESCROW_SECRET_KEY;
      const match = await hasher.comparePassword(password, storedPassword);

      if (!match) continue;
      const token = await this.jwtService.generateAnyToken({
        id: peopleId,
        originUserId: originUserId,
        platform: platform,
        iat: new Date(createdAt ?? '').getTime(),
      });

      const from = getKeyring().addFromUri('//' + token);

      let balance = 0;

      if (native) {
        const nativeBalance = await api.query.system.account(from.publicKey);

        balance = nativeBalance.data.free.toJSON();
      } else {
        const nonNativeBalance: AnyObject = await api.query.tokens.accounts(
          from.publicKey,
          {Token: symbol},
        );
        const result = nonNativeBalance.toJSON();

        balance = result.free;
      }

      if (!balance) continue;

      const paymentInfo = {
        amount: balance,
        to: to,
        from: from,
        currencyId: id,
        decimal: decimal,
        native: native,
      };

      const txFee = await this.getTransactionFee(api, paymentInfo);
      const existensial = api.consts.balances?.existentialDeposit.toBigInt();
      const transferBalance = BigInt(balance - txFee);

      if (transferBalance < existensial) continue;

      let transfer = api.tx.balances.transfer(
        to,
        new BN(transferBalance.toString()),
      );

      if (!native) {
        transfer = api.tx.currencies.transfer(
          to,
          {Token: id},
          new BN(transferBalance.toString()),
        );
      }

      const hash = await new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        transfer.signAndSend(from, ({status, isError}) => {
          if (status.isFinalized) {
            const blockHash = status.asFinalized.toHex();
            resolve(blockHash);
          } else if (isError) {
            reject();
          }
        });
      });

      if (hash && typeof hash === 'string') {
        const transaction = await this.transactionRepository.create({
          hash: hash,
          amount: Number(transferBalance) / 10 ** decimal,
          to: to,
          from: getHexPublicKey(from),
          currencyId: id,
        });

        try {
          const user = await this.walletRepository.user(to);
          await Promise.allSettled([
            this.notificationService.sendClaimTips(transaction),
            this.activityLogRepository.create({
              type: ActivityLogType.CLAIMTIP,
              userId: user.id,
              referenceId: transaction.id ?? '',
              referenceType: ReferenceType.TRANSACTION,
            }),
          ]);
        } catch {
          // ignore
        }
      }
    }

    await api.disconnect();

    return;
  }

  async getTransactionFee(
    blockchainApi: ApiPromise,
    paymentInfo: PaymentInfo,
  ): Promise<number> {
    const {amount, to, from, currencyId, decimal, native} = paymentInfo;
    let txFee = 0;

    try {
      if (native) {
        const {weight, partialFee} = await blockchainApi.tx.balances
          .transfer(to, new BN(Number(amount).toString()))
          .paymentInfo(from);

        txFee = Math.floor(+weight.toString() + +partialFee.toString());
      } else {
        const cryptoAcaPoolString = (
          await blockchainApi.query.dex.liquidityPool([
            {Token: 'ACA'},
            {Token: currencyId},
          ])
        ).toString();

        const cryptoAcaPool = cryptoAcaPoolString
          .substring(1, cryptoAcaPoolString.length - 1)
          .replace(/"/g, '')
          .split(',');

        const crypto = parseInt(cryptoAcaPool[1]) / 10 ** decimal;
        const aca = parseInt(cryptoAcaPool[0]) / 10 ** 13;
        const cryptoPerAca = crypto / aca;

        // Get transaction fee
        const {weight, partialFee} = await blockchainApi.tx.currencies
          .transfer(to, {Token: currencyId}, new BN(Number(amount).toString()))
          .paymentInfo(from);

        const txFeeInAca =
          (+weight.toString() + +partialFee.toString()) / 10 ** 13;

        txFee = Math.floor(txFeeInAca * cryptoPerAca * 10 ** decimal);
      }
    } catch (err) {
      // ignore
    }

    return txFee;
  }

  async getQueueNumber(nonce: number, type: string): Promise<number> {
    const queue = await this.queueRepository.findOne({
      where: {
        id: type,
      },
    });

    let priority = nonce;

    if (!queue) {
      await this.queueRepository.create({
        id: type,
        priority: priority + 1,
      });
    } else {
      if (queue.priority >= priority) priority = queue.priority;
      else priority = nonce;
      await this.queueRepository.updateById(queue.id, {
        priority: priority + 1,
      });
    }

    return priority;
  }

  async connect(rpcURL: string, types?: AnyObject): Promise<ApiPromise> {
    const {polkadotApi} = new PolkadotJs();

    try {
      return await polkadotApi(rpcURL, types);
    } catch {
      throw new HttpErrors.UnprocessableEntity('Unable to connect');
    }
  }
}
