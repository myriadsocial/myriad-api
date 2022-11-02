import {BindingScope, injectable, service} from '@loopback/core';
import {Filter, repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {Currency, UserCurrency} from '../models';
import {
  CurrencyRepository,
  ExchangeRateRepository,
  QueueRepository,
  TransactionRepository,
  UserCurrencyRepository,
  WalletRepository,
} from '../repositories';
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
