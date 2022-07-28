import {BindingScope, service, injectable} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {ApiPromise} from '@polkadot/api';
import {config} from '../config';
import {
  CurrencyRepository,
  NetworkRepository,
  QueueRepository,
  TransactionRepository,
  UserCurrencyRepository,
  WalletRepository,
} from '../repositories';
import {PolkadotJs} from '../utils/polkadotJs-utils';
import {HttpErrors} from '@loopback/rest';
import {NotificationService} from './notification.service';
import {BN} from '@polkadot/util';
import {UserCurrency} from '../models';
import {DateUtils} from '../utils/date-utils';

const dateUtils = new DateUtils();

@injectable({scope: BindingScope.TRANSIENT})
export class CurrencyService {
  constructor(
    @repository(CurrencyRepository)
    public currencyRepository: CurrencyRepository,
    @repository(TransactionRepository)
    public transactionRepository: TransactionRepository,
    @repository(QueueRepository)
    protected queueRepository: QueueRepository,
    @repository(UserCurrencyRepository)
    protected userCurrencyRepository: UserCurrencyRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
    @repository(NetworkRepository)
    protected networkRepository: NetworkRepository,
    @service(NotificationService)
    protected notificationService: NotificationService,
  ) {}

  async addUserCurrencies(userId: string, networkId: string): Promise<void> {
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

  async updateUserCurrency(userId: string, networkId: string): Promise<void> {
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
      return this.addUserCurrencies(userId, networkId);
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

  async sendMyriadReward(address: string, networkType: string): Promise<void> {
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
    const {nonce} = await api.query.system.account(sender.address);
    const getNonce = await this.getQueueNumber(nonce.toJSON(), 'MYRIA');

    const hash = await new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      transfer.signAndSend(sender, {nonce: getNonce}, ({status, isError}) => {
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
      const wallet = await this.walletRepository.findById(from);
      const transaction = await this.transactionRepository.create({
        hash: hash,
        amount: rewardAmount / 10 ** decimal,
        to: to,
        from: wallet.id,
        currencyId: id,
      });
      await this.notificationService.sendInitialTips(transaction);
    }
  }

  async getQueueNumber(nonce: number, type: string): Promise<number> {
    const queue = await this.queueRepository.get(type);

    let priority = nonce;

    if (queue?.priority >= priority) priority = queue.priority;
    else priority = nonce;

    await this.queueRepository.set(type, {priority: priority + 1});
    await this.queueRepository.expire(type, 1 * dateUtils.hour);

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
