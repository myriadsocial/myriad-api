import {BindingScope, service, injectable} from '@loopback/core';
import {repository} from '@loopback/repository';
import {ApiPromise} from '@polkadot/api';
import {config} from '../config';
import {DefaultCurrencyType} from '../enums';
import {Balance, PaymentInfo} from '../interfaces';
import {UserSocialMedia} from '../models';
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
import {TransactionService} from './transaction.service';
import acala from '../data-seed/currencies.json';
import {NotificationService} from './notification.service';

const BN = require('bn.js');

@injectable({scope: BindingScope.TRANSIENT})
export class CurrencyService {
  constructor(
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
    @repository(UserCurrencyRepository)
    protected userCurrencyRepository: UserCurrencyRepository,
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
  ) {}

  async defaultCurrency(userId: string): Promise<void> {
    const currencies = [
      {
        id: DefaultCurrencyType.MYRIA,
        decimal: 12,
        image:
          'https://pbs.twimg.com/profile_images/1407599051579617281/-jHXi6y5_400x400.jpg',
        rpcURL: config.MYRIAD_WS_RPC,
        native: true,
      },
      acala[0],
    ];
    for (const currency of currencies) {
      try {
        await this.userRepository.currencies(userId).create(currency);
      } catch {
        await this.userCurrencyRepository.create({
          userId: userId,
          currencyId: currency.id,
        });
      }
    }
  }

  async defaultAcalaTips(userId: string): Promise<void> {
    try {
      const {polkadotApi, getKeyring, getHexPublicKey} = new PolkadotJs();
      const api = await polkadotApi(acala[0].rpcURL, acala[0].types);

      const mnemonic = config.MYRIAD_MNEMONIC;
      const from = getKeyring().addFromMnemonic(mnemonic);
      const to = userId;

      const acalaDecimal = 12;
      const value = config.ACALA_AUSD_REWARD_AMOUNT * 10 ** acalaDecimal;

      const {nonce} = await api.query.system.account(from.address);
      const getNonce = await this.getQueueNumber(
        nonce.toJSON(),
        DefaultCurrencyType.AUSD,
      );

      const transfer = api.tx.currencies.transfer(
        to,
        {Token: DefaultCurrencyType.AUSD},
        value,
      );
      const txHash = await transfer.signAndSend(from, {nonce: getNonce});

      const myriadUser = await this.userRepository.findOne({
        where: {id: getHexPublicKey(from)},
      });
      if (!myriadUser)
        await this.userRepository.create({
          id: getHexPublicKey(from),
          name: 'Myriad',
        });

      const transaction = await this.transactionRepository.create({
        hash: txHash.toString(),
        amount: value / 10 ** acalaDecimal,
        to: to,
        from: getHexPublicKey(from),
        currencyId: DefaultCurrencyType.AUSD,
      });

      await this.notificationService.sendIntitalAUSD(transaction);

      await api.disconnect();
    } catch {
      // ignore
    }
  }

  async sendMyriadReward(userId: string): Promise<void> {
    try {
      if (config.MYRIAD_REWARD_AMOUNT === 0) return;

      const {rpcURL: myriadRpc, decimal: myriadDecimal} =
        await this.currencyRepository.findById(DefaultCurrencyType.MYRIA);

      const {polkadotApi, getKeyring, getHexPublicKey} = new PolkadotJs();
      const api = await polkadotApi(myriadRpc);

      const mnemonic = config.MYRIAD_MNEMONIC;
      const from = getKeyring().addFromMnemonic(mnemonic);
      const to = userId;

      const rewardAmount = config.MYRIAD_REWARD_AMOUNT * 10 ** myriadDecimal;

      const {nonce} = await api.query.system.account(from.address);
      const getNonce = await this.getQueueNumber(
        nonce.toJSON(),
        DefaultCurrencyType.MYRIA,
      );

      const transfer = api.tx.balances.transfer(
        to,
        new BN(rewardAmount.toString()),
      );
      const txHash = await transfer.signAndSend(from, {nonce: getNonce});

      const myriadUser = await this.userRepository.findOne({
        where: {id: getHexPublicKey(from)},
      });
      if (!myriadUser)
        await this.userRepository.create({
          id: getHexPublicKey(from),
          name: 'Myriad',
        });

      const transaction = await this.transactionRepository.create({
        hash: txHash.toString(),
        amount: rewardAmount / 10 ** myriadDecimal,
        to: to,
        from: getHexPublicKey(from),
        currencyId: DefaultCurrencyType.MYRIA,
      });

      await this.notificationService.sendRewardSuccess(transaction);

      await api.disconnect();
    } catch (error) {
      // ignore
    }
  }

  async claimTips(userSocialMedia: UserSocialMedia): Promise<void> {
    const {userId, peopleId} = userSocialMedia;
    const {polkadotApi, getKeyring, getHexPublicKey} = new PolkadotJs();

    const from = getKeyring().addFromUri('//' + peopleId);
    const to = userId;

    const userCurrencies = await this.userCurrencyRepository.find({
      where: {
        userId: userId,
        currencyId: {
          nlike: DefaultCurrencyType.MYRIA,
        },
      },
      include: ['currency'],
    });

    let api = null;
    let initRpcURL = null;

    for (let i = 0; i < userCurrencies.length; i++) {
      const userCurrency = userCurrencies[i];
      const {id, decimal, rpcURL, native, types} = userCurrency.currency;

      let balance = 0;

      try {
        if (!api || !initRpcURL) {
          api = await polkadotApi(rpcURL, types);
          initRpcURL = rpcURL;
        }

        if (api && initRpcURL !== rpcURL) {
          await api.disconnect();

          api = await polkadotApi(rpcURL, types);
          initRpcURL = rpcURL;
        }

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

        let transfer = null;

        if (native) transfer = api.tx.balances.transfer(to, balance - txFee);
        else
          transfer = api.tx.currencies.transfer(
            to,
            {Token: id},
            balance - txFee,
          );

        const txHash = await transfer.signAndSend(from);

        const transaction = await this.transactionRepository.create({
          hash: txHash.toString(),
          amount: balance / 10 ** decimal,
          to: to,
          from: getHexPublicKey(from),
          currencyId: id,
        });

        await this.notificationService.sendClaimTips(transaction);

        if (api && i === userCurrencies.length - 1) await api.disconnect();
      } catch (err) {
        // ignore
      }
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
          .transfer(to, Number(amount))
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
          .transfer(to, {Token: currencyId}, Number(amount))
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
}
