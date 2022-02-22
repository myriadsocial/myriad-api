import {repository} from '@loopback/repository';
import {param, get, response} from '@loopback/rest';
import {ExchangeRate} from '../models';
import {ExchangeRateRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
export class ExchangeRateController {
  constructor(
    @repository(ExchangeRateRepository)
    public exchangeRateRepository: ExchangeRateRepository,
  ) {}

  @authenticate.skip()
  @get('/exchange-rates/{id}')
  @response(200, {
    description: 'ExchangeRate is read',
    content: {
      'application/json': {
        schema: {'x-ts-type': ExchangeRate},
      },
    },
  })
  async findById(@param.path.string('id') id: string): Promise<ExchangeRate> {
    const rate = await this.exchangeRateRepository.get(id);
    if (!rate) return new ExchangeRate({price: 0});
    return rate;
  }
}
