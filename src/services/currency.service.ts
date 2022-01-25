import {BindingScope, service, injectable, inject} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {ApiPromise} from '@polkadot/api';
import {config} from '../config';
import {ActivityLogType, DefaultCurrencyType, ReferenceType} from '../enums';
import {Balance, PaymentInfo} from '../interfaces';
import {Currency, UserSocialMedia} from '../models';
import {
  CurrencyRepository,
  PeopleRepository,
  QueueRepository,
  TransactionRepository,
  UserCurrencyRepository,
  UserRepository,
  UserSocialMediaRepository,
} from '../repositories';
import {PolkadotJs} from '../utils/polkadotJs-utils';
import {HttpErrors} from '@loopback/rest';
import {BcryptHasher} from './authentication/hash.password.service';
import {NotificationService} from './notification.service';
import {TransactionService} from './transaction.service';
import {ActivityLogService} from './activity-log.service';
import {JWTService} from './authentication';
import {TokenServiceBindings} from '../keys';
import {BN} from '@polkadot/util';
import {CoinMarketCap} from './coin-market-cap.service';

@injectable({scope: BindingScope.TRANSIENT})
export class CurrencyService {
  constructor(
    @repository(CurrencyRepository)
    public currencyRepository: CurrencyRepository,
    @repository(UserCurrencyRepository)
    public userCurrencyRepository: UserCurrencyRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(UserSocialMediaRepository)
    protected userSocialMediaRepository: UserSocialMediaRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @repository(TransactionRepository)
    protected transactionRepository: TransactionRepository,
    @repository(QueueRepository)
    protected queueRepository: QueueRepository,
    @service(TransactionService)
    protected transactionService: TransactionService,
    @service(NotificationService)
    protected notificationService: NotificationService,
    @service(ActivityLogService)
    protected activityLogService: ActivityLogService,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    protected jwtService: JWTService,
    @inject('services.CoinMarketCap')
    protected coinMarketCapService: CoinMarketCap,
  ) {}

  async defaultCurrency(userId: string): Promise<void> {
    const currency = {
      id: DefaultCurrencyType.MYRIA,
      decimal: 18,
      image:
        'https://pbs.twimg.com/profile_images/1407599051579617281/-jHXi6y5_400x400.jpg',
      rpcURL: config.MYRIAD_RPC_WS_URL,
      native: true,
      networkType: 'substrate',

      exchangeRate: false,
    };

    try {
      await this.userRepository.currencies(userId).create(currency);
    } catch {
      await this.userCurrencyRepository.create({
        userId: userId,
        currencyId: currency.id,
      });
    }
  }

  async sendMyriadReward(userId: string): Promise<void> {
    if (!config.MYRIAD_REWARD_AMOUNT) return;
    if (config.MYRIAD_REWARD_AMOUNT === 0) return;

    try {
      const {rpcURL: myriadRpc, decimal: myriadDecimal} =
        await this.currencyRepository.findById(DefaultCurrencyType.MYRIA);

      const {polkadotApi, getKeyring} = new PolkadotJs();
      const api = await polkadotApi(myriadRpc);

      const mnemonic = config.MYRIAD_FAUCET_MNEMONIC;
      const from = getKeyring().addFromMnemonic(mnemonic);
      const to = userId;

      const rewardAmount = config.MYRIAD_REWARD_AMOUNT * 10 ** myriadDecimal;

      const transfer = api.tx.balances.transfer(
        to,
        new BN(rewardAmount.toString()),
      );
      const {nonce} = await api.query.system.account(from.address);
      const getNonce = await this.getQueueNumber(
        nonce.toJSON(),
        DefaultCurrencyType.MYRIA,
      );

      let hash: string | null = null;

      await transfer.signAndSend(
        from,
        {nonce: getNonce},
        async ({status, events}) => {
          if (status.isInBlock || status.isFinalized) {
            let transactionStatus = null;

            if (status.isInBlock) hash = status.asInBlock.toString();

            events
              .filter(({event}) => event.section === 'system')
              .forEach(event => {
                const method = event.event.method;

                if (method === 'ExtrinsicSuccess') {
                  transactionStatus = 'success';
                }
              });

            if (status.isFinalized) {
              if (transactionStatus === 'success' && hash) {
                try {
                  const transaction = await this.transactionRepository.create({
                    hash: hash,
                    amount: rewardAmount / 10 ** myriadDecimal,
                    to: to,
                    from: config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY,
                    currencyId: DefaultCurrencyType.MYRIA,
                  });

                  await this.notificationService.sendInitialTips(transaction);
                } catch {
                  // ignore
                }
              }

              await api.disconnect();
            }
          }
        },
      );
    } catch {
      // ignore
    }
  }

  // Automatic claimed
  async autoClaimTips(userSocialMedia: UserSocialMedia): Promise<void> {
    const {userId, peopleId} = userSocialMedia;

    try {
      const people = await this.peopleRepository.findById(peopleId);
      const token = await this.jwtService.generateAnyToken({
        id: people.id,
        originUserId: people.originUserId,
        platform: people.platform,
        iat: new Date(people.createdAt ?? '').getTime(),
      });

      const {polkadotApi, getKeyring, getHexPublicKey} = new PolkadotJs();
      const from = getKeyring().addFromUri('//' + token);
      const to = userId;

      const currencies = await this.currencyRepository.find();

      for (const currency of currencies) {
        const {id, decimal, rpcURL, native, types} = currency;
        const api = await polkadotApi(rpcURL, types);

        let balance = 0;

        try {
          if (native) {
            const nativeBalance = await api.query.system.account(
              from.publicKey,
            );

            balance = nativeBalance.data.free.toJSON();
          } else {
            const nonNativeBalance = await api.query.tokens.accounts(
              from.publicKey,
              {Token: id},
            );
            const result = nonNativeBalance.toJSON() as unknown as Balance;

            balance = result.free;
          }

          if (!balance) continue;

          const paymentInfo = {
            amount: balance,
            to: to,
            from: from,
            currencyId: id as DefaultCurrencyType,
            decimal: decimal,
            native: native,
          };

          const txFee = await this.getTransactionFee(api, paymentInfo);

          if (balance - txFee < 0) continue;

          let transfer = null;

          if (native)
            transfer = api.tx.balances.transfer(
              to,
              new BN((balance - txFee).toString()),
            );
          else
            transfer = api.tx.currencies.transfer(
              to,
              {Token: id},
              new BN((balance - txFee).toString()),
            );

          let txHash: string | null = null;

          await transfer.signAndSend(from, async ({status, events}) => {
            if (status.isInBlock || status.isFinalized) {
              let transactionStatus = null;

              if (status.isInBlock) txHash = status.asInBlock.toString();

              events
                .filter(({event}) => event.section === 'system')
                .forEach(event => {
                  const method = event.event.method;

                  if (method === 'ExtrinsicSuccess') {
                    transactionStatus = 'success';
                  }
                });

              if (status.isFinalized) {
                if (transactionStatus === 'success' && txHash) {
                  try {
                    const transaction = await this.transactionRepository.create(
                      {
                        hash: txHash,
                        amount: balance / 10 ** decimal,
                        to: to,
                        from: getHexPublicKey(from),
                        currencyId: id,
                      },
                    );

                    await this.notificationService.sendClaimTips(transaction);
                  } catch {
                    // ignore
                  }
                }

                await api.disconnect();
              }
            }
          });
        } catch (err) {
          // ignore
        }
      }
    } catch (err) {
      // ignore
    }
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

  // Manually claimmed
  async claimTips(userId: string, currencyId: string): Promise<void> {
    const {id, decimal, rpcURL, native, types} =
      await this.currencyRepository.findById(currencyId);
    const {polkadotApi, getKeyring, getHexPublicKey} = new PolkadotJs();
    const hasher = new BcryptHasher();
    const userSocialMedias = await this.userSocialMediaRepository.find({
      where: {userId: userId},
      include: ['people'],
    });
    const people = userSocialMedias.map(e => e.people);
    const to = userId;

    let api: ApiPromise;
    let balance = 0;

    try {
      api = await polkadotApi(rpcURL, types);
    } catch {
      throw new HttpErrors.UnprocessableEntity('Unable to claim!');
    }

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

      if (native) {
        const nativeBalance = await api.query.system.account(from.publicKey);

        balance = nativeBalance.data.free.toJSON();
      } else {
        const nonNativeBalance = await api.query.tokens.accounts(
          from.publicKey,
          {Token: id},
        );
        const result = nonNativeBalance.toJSON() as unknown as Balance;

        balance = result.free;
      }

      if (!balance) continue;

      const paymentInfo = {
        amount: balance,
        to: to,
        from: from,
        currencyId: id as DefaultCurrencyType,
        decimal: decimal,
        native: native,
      };

      const txFee = await this.getTransactionFee(api, paymentInfo);

      if (balance - txFee < 0) continue;

      let transfer;

      if (native) transfer = api.tx.balances.transfer(to, balance - txFee);
      else {
        transfer = api.tx.currencies.transfer(to, {Token: id}, balance - txFee);
      }

      const txHash = await transfer.signAndSend(from);

      const transaction = await this.transactionRepository.create({
        hash: txHash.toString(),
        amount: balance / 10 ** decimal,
        to: to,
        from: getHexPublicKey(from),
        currencyId: id,
      });

      await this.activityLogService.createLog(
        ActivityLogType.CLAIMTIP,
        to,
        transaction.id ?? '',
        ReferenceType.TRANSACTION,
      );
      await this.notificationService.sendClaimTips(transaction);
    }

    await api.disconnect();

    return;
  }

  async getBalance(userId: string, currencyId: string): Promise<AnyObject> {
    const {id, rpcURL, native, types, decimal} =
      await this.currencyRepository.findById(currencyId);
    const {polkadotApi, getKeyring} = new PolkadotJs();
    const hasher = new BcryptHasher();
    const userSocialMedias = await this.userSocialMediaRepository.find({
      where: {userId: userId},
      include: ['people'],
    });
    const people = userSocialMedias.map(e => e.people);

    let api: ApiPromise;

    try {
      api = await polkadotApi(rpcURL, types);
    } catch {
      throw new HttpErrors.UnprocessableEntity('Unable to show balance!');
    }

    let totalBalance = 0;

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

      const address = getKeyring().addFromUri('//' + token);

      if (native) {
        const nativeBalance = await api.query.system.account(address.address);

        totalBalance += nativeBalance.data.free.toJSON();
      } else {
        const nonNativeBalance = await api.query.tokens.accounts(
          address.publicKey,
          {Token: id},
        );

        totalBalance += (nonNativeBalance.toJSON() as unknown as Balance).free;
      }
    }

    await api.disconnect();

    return {
      currencyId: id,
      balance: totalBalance / decimal,
    };
  }

  async getQueueNumber(
    nonce: number,
    type: DefaultCurrencyType,
  ): Promise<number> {
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

  async verifyRpcAddressConnection(
    currency: Currency,
  ): Promise<Omit<Currency, 'id'>> {
    let native = false;
    let api: ApiPromise;
    let exchangeRate = false;

    const {id, rpcURL, types} = currency;

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

    try {
      const {data} = await this.coinMarketCapService.getActions(
        `cryptocurrency/quotes/latest?symbol=${currencyId}`,
      );

      const currencyInfo = data[currencyId];

      if (
        currency.networkType === 'substrate' &&
        currencyInfo.tags.find((tag: string) => tag === 'substrate') &&
        !currencyInfo.platform
      ) {
        exchangeRate = true;
      }
    } catch (error) {
      const err = JSON.parse(error.message);

      // Testing will pass this error
      if (err.status && currency.networkType !== 'substrate-test') {
        if (err.status.error_code === 1002 || err.status.error_code === 1008) {
          throw new HttpErrors.UnprocessableEntity(err.status.error_message);
        }
      }
    }

    await api.disconnect();

    return Object.assign(currency, {
      id: currencyId,
      decimal: symbolsDecimals[currencyId],
      native,
      exchangeRate,
    });
  }
}
