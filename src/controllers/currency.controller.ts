import {authenticate} from '@loopback/authentication';
import {intercept, service} from '@loopback/core';
import {Filter} from '@loopback/repository';
import {get, getModelSchemaRef, param, response} from '@loopback/rest';
import {PaginationInterceptor} from '../interceptors';
import {Currency} from '../models';
import {CurrencyService} from '../services';

@authenticate('jwt')
export class CurrencyController {
  constructor(
    @service(CurrencyService)
    protected currencyService: CurrencyService,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/currencies')
  @response(200, {
    description: 'Array of Currency model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Currency, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Currency, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<Currency>,
    @param.query.boolean('rates') rates = false,
  ): Promise<Currency[]> {
    return this.currencyService.find(filter, rates);
  }
}
