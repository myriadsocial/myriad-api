import {CronJob, cronJob} from '@loopback/cron';
import {inject} from '@loopback/core';
import {CoinMarketCap} from '../services';
import {repository} from '@loopback/repository';
import {CurrencyRepository, ExchangeRateRepository} from '../repositories';
import {DefaultCurrencyType} from '../enums';

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
      onTick: async () => {
        await this.performJob();
      },
      cronTime: '0 */5 * * * *',
      start: true,
    });
  }

  async performJob() {
    const currencies = await this.currencyRepository.find();
    const currencyIds = currencies
      .map(currency => currency.id)
      .filter(currencyId => currencyId !== DefaultCurrencyType.MYRIA);

    try {
      const {data} = await this.coinMarketCapService.getActions(
        `cryptocurrency/quotes/latest?symbol=${currencyIds.join(',')}`,
      );

      for (const currencyId of currencyIds) {
        const price = data[currencyId].quote.USD.price;
        const found = await this.exchangeRateRepository.findOne({
          where: {
            id: currencyId,
          },
        });

        if (found) {
          await this.exchangeRateRepository.updateById(currencyId, {
            price: price,
            updatedAt: new Date().toString(),
          });
        } else {
          await this.exchangeRateRepository.create({
            id: currencyId,
            price: price,
          });
        }
      }
    } catch {
      // ignore
    }
  }
}
