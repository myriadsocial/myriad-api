import {BindingScope, injectable, service} from '@loopback/core';
import {Filter, repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import type {AccountInfo} from '@polkadot/types/interfaces';
import {BN} from '@polkadot/util';
import {config} from '../config';
import {Currency, UserCurrency, Wallet} from '../models';
import {
  CurrencyRepository,
  ExchangeRateRepository,
  QueueRepository,
  TransactionRepository,
  UserCurrencyRepository,
  WalletRepository,
} from '../repositories';
import {PolkadotJs} from '../utils/polkadot-js';
import {NotificationService} from './notification.service';

@injectable({scope: BindingScope.TRANSIENT})
export class CurrencyService {
  constructor(
    @repository(CurrencyRepository)
    private currencyRepository: CurrencyRepository,
    @repository(ExchangeRateRepository)
    private exchangeRateRepository: ExchangeRateRepository,
    @repository(TransactionRepository)
    private transactionRepository: TransactionRepository,
    @repository(QueueRepository)
    private queueRepository: QueueRepository,
    @repository(UserCurrencyRepository)
    private userCurrencyRepository: UserCurrencyRepository,
    @repository(WalletRepository)
    private walletRepository: WalletRepository,
    @service(NotificationService)
    private notificationService: NotificationService,
  ) {}

  public async findById(
    id: string,
    filter?: Filter<Currency>,
  ): Promise<Currency> {
    return this.currencyRepository.findById(id, filter);
  }

  public async find(
    filter?: Filter<Currency>,
    rates = false,
  ): Promise<Currency[]> {
    const currencies = await this.currencyRepository.find(filter);

    if (rates) {
      return Promise.all(
        currencies.map(async currency => {
          let price = 0;

          if (currency.exchangeRate) {
            const rate = await this.exchangeRateRepository.get(currency.symbol);
            if (rate) price = rate.price;
          }

          return new Currency({...currency, price});
        }),
      );
    }

    return currencies;
  }

  public async create(userId: string, networkId: string): Promise<void> {
    const currencies = await this.currencyRepository.find({
      where: {networkId},
      order: ['native DESC'],
    });

    await Promise.all(
      currencies.map(async (currency, index) => {
        const found = await this.userCurrencyRepository.findOne({
          where: {
            userId,
            networkId,
            currencyId: currency.id,
          },
        });

        if (found) return;

        return this.userCurrencyRepository.create({
          userId: userId,
          networkId: networkId,
          currencyId: currency.id,
          priority: index + 1,
        });
      }),
    );
  }

  public async update(userId: string, networkId: string): Promise<void> {
    if (!userId || !networkId) return;

    const [{count: countCurrency}, {count: countUserCurrency}] =
      await Promise.all([
        this.currencyRepository.count({networkId}),
        this.userCurrencyRepository.count({
          networkId,
          userId,
        }),
      ]);
    if (countUserCurrency === 0) {
      return this.create(userId, networkId);
    }

    if (countCurrency > countUserCurrency) {
      const userCurrencies = await this.userCurrencyRepository.find({
        where: {networkId, userId},
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

      const newUserCurrencies = currencies.map((currency, index) => {
        return new UserCurrency({
          userId,
          networkId,
          currencyId: currency.id,
          priority: countUserCurrency + 1 + index,
        });
      });

      await this.userCurrencyRepository.createAll(newUserCurrencies);
      return;
    }
  }

  public async setPriority(
    userId: string,
    currencyIds: string[],
  ): Promise<void> {
    const wallet = await this.walletRepository.findOne({
      where: {userId, primary: true},
    });

    if (!wallet) throw new HttpErrors.UnprocessableEntity('WalletNotFound');

    const networkId = wallet.networkId;
    const [{count: countCurrency}, {count: countCurrencyNetwork}] =
      await Promise.all([
        this.currencyRepository.count({id: {inq: currencyIds}, networkId}),
        this.currencyRepository.count({networkId}),
      ]);

    if (
      countCurrency !== currencyIds.length ||
      countCurrencyNetwork !== currencyIds.length
    ) {
      throw new HttpErrors.UnprocessableEntity('Total currency not match');
    }

    await Promise.all(
      currencyIds.map(async (currencyId, index) => {
        return this.userCurrencyRepository.updateAll(
          {priority: index + 1},
          {userId, currencyId, networkId},
        );
      }),
    );
  }

  public async sendMyria(wallet: Wallet): Promise<void> {
    const {userId: toUserId, networkId: networkType, id: address} = wallet;

    if (networkType !== 'myriad') return;
    if (!config.MYRIAD_FAUCET_AMOUNT) return;
    if (config.MYRIAD_FAUCET_AMOUNT === 0) return;

    const currency = await this.currencyRepository.findOne({
      where: {
        networkId: 'myriad',
        symbol: 'MYRIA',
      },
      include: ['network'],
    });

    if (!currency || !currency.network) return;
    const {id, decimal, network} = currency;
    const rpcURL = network.rpcURL;
    const {polkadotApi, getKeyring, getHexPublicKey} = new PolkadotJs();
    const api = await polkadotApi(rpcURL);

    const mnemonic = config.MYRIAD_FAUCET_MNEMONIC;
    const sender = getKeyring().addFromMnemonic(mnemonic);
    const from = getHexPublicKey(sender);
    const to = address;

    const rewardAmount = config.MYRIAD_FAUCET_AMOUNT * 10 ** decimal;

    const transfer = api.tx.balances.transfer(
      to,
      new BN(rewardAmount.toString()),
    );
    const {nonce} = await api.query.system.account<AccountInfo>(sender.address);
    const number = await this.queue(nonce.toJSON(), 'MYRIA');

    const hash = await new Promise((resolve, reject) => {
      transfer
        .signAndSend(sender, {nonce: number}, ({status, isError}) => {
          if (status.isFinalized) {
            const blockHash = status.asFinalized.toHex();
            resolve(blockHash);
          } else if (isError) {
            reject();
          }
        })
        .catch(() => reject());
    });

    await api.disconnect();

    if (hash && typeof hash === 'string') {
      const fromWallet = await this.walletRepository.findById(from);
      const transaction = await this.transactionRepository.create({
        hash: hash,
        amount: rewardAmount / 10 ** decimal,
        to: toUserId,
        from: fromWallet.userId,
        currencyId: id,
      });
      await this.notificationService.sendInitialTips(transaction);
    }
  }

  private async queue(nonce: number, type: string): Promise<number> {
    const queue = await this.queueRepository.get(type);

    let priority = nonce;

    if (queue?.priority >= priority) priority = queue.priority;
    else priority = nonce;

    await this.queueRepository.set(type, {priority: priority + 1});
    await this.queueRepository.expire(type, 60 * 60 * 1000);

    return priority;
  }
}
