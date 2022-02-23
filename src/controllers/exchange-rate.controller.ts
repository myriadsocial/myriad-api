import {repository} from '@loopback/repository';
import {param, get, response, getModelSchemaRef} from '@loopback/rest';
import {ExchangeRate} from '../models';
import {CurrencyRepository, ExchangeRateRepository} from '../repositories';

export class ExchangeRateController {
  constructor(
    @repository(CurrencyRepository)
    public currencyRepository: CurrencyRepository,
    @repository(ExchangeRateRepository)
    public exchangeRateRepository: ExchangeRateRepository,
  ) {}

  @get('/exchange-rates')
  @response(200, {
    description: 'Array of ExchangeRate model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(ExchangeRate),
        },
      },
    },
  })
  async find(): Promise<ExchangeRate[]> {
    const currencies = await this.currencyRepository.find({
      where: {
        exchangeRate: true,
      },
    });

    if (currencies.length === 0) return [];
    return Promise.all(
      currencies.map(async currency => {
        const rate = await this.exchangeRateRepository.get(currency.id);

        const exchangeRate = new ExchangeRate({id: currency.id, price: 0});

        if (rate) exchangeRate.price = rate.price;
        return exchangeRate;
      }),
    );
  }

  @get('/exchange-rates/{id}')
  @response(200, {
    description: 'ExchangeRate model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(ExchangeRate),
      },
    },
  })
  async findById(@param.path.string('id') id: string): Promise<ExchangeRate> {
    const rate = await this.exchangeRateRepository.get(id);
    if (!rate) return new ExchangeRate({id, price: 0});
    return rate;
  }
}
