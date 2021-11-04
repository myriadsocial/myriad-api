import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {param, get, getModelSchemaRef, response} from '@loopback/rest';
import {ExchangeRate} from '../models';
import {ExchangeRateRepository} from '../repositories';

export class ExchangeRateController {
  constructor(
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
          items: getModelSchemaRef(ExchangeRate, {includeRelations: true}),
        },
      },
    },
  })
  async find(@param.filter(ExchangeRate) filter?: Filter<ExchangeRate>): Promise<ExchangeRate[]> {
    return this.exchangeRateRepository.find(filter);
  }

  @get('/exchange-rates/{id}')
  @response(200, {
    description: 'ExchangeRate model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(ExchangeRate, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(ExchangeRate, {exclude: 'where'})
    filter?: FilterExcludingWhere<ExchangeRate>,
  ): Promise<ExchangeRate> {
    return this.exchangeRateRepository.findById(id, filter);
  }
}
