import {inject} from '@loopback/core';
import {CronJob, cronJob} from '@loopback/cron';
import {repository} from '@loopback/repository';
import {ExchangeRate} from '../models';
import {CurrencyRepository, ExchangeRateRepository} from '../repositories';
import {CoinMarketCap} from '../services';

@cronJob()
export class UpdateExchangeRateJob extends CronJob {
  constructor(
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
    @repository(ExchangeRateRepository)
    protected exchangeRateRepository: ExchangeRateRepository,
    @inject('services.CoinMarketCap')
    protected coinMarketCapService: CoinMarketCap,
  ) {
    super({
      name: 'update-coin-market-cap-job',
      onTick: () => {
        this.performJob().finally(console.log);
      },
      cronTime: '0 */5 * * * *',
      start: true,
    });
  }

  async performJob(): Promise<void> {
    const currencies = await this.currencyRepository.find({
      where: {
        exchangeRate: true,
      },
    });
    const currencyIds = currencies.map(currency => currency.symbol);

    if (currencyIds.length === 0) return;

    try {
      const {data} = await this.coinMarketCapService.getActions(
        `cryptocurrency/quotes/latest?symbol=${currencyIds.join(',')}`,
      );

      for (const currencyId of currencyIds) {
        const price = data[currencyId].quote.USD.price;
        const exchangeRate = new ExchangeRate({id: currencyId, price: price});

        await this.exchangeRateRepository.set(currencyId, exchangeRate);
      }
    } catch {
      // ignore
    }
  }
}
