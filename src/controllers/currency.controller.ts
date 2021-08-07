import {intercept} from '@loopback/core';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {del, get, getModelSchemaRef, param, post, requestBody, response} from '@loopback/rest';
import {PaginationInterceptor, ValidateCurrencyInterceptor} from '../interceptors';
import {Currency, CustomFilter} from '../models';
import {CurrencyRepository} from '../repositories';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class CurrencyController {
  constructor(
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
  ) {}

  @intercept(ValidateCurrencyInterceptor.BINDING_KEY)
  @post('/currencies')
  @response(200, {
    description: 'Currency model instance',
    content: {'application/json': {schema: getModelSchemaRef(Currency)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Currency, {
            title: 'NewCurrency',
          }),
        },
      },
    })
    currency: Currency,
  ): Promise<Currency> {
    return this.currencyRepository.create(currency);
  }

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
    @param.query.object('filter', getModelSchemaRef(CustomFilter)) filter: CustomFilter,
  ): Promise<Currency[]> {
    return this.currencyRepository.find(filter as Filter<Currency>);
  }

  @get('/currencies/{id}')
  @response(200, {
    description: 'Currency model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Currency, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Currency, {exclude: 'where'})
    filter?: FilterExcludingWhere<Currency>,
  ): Promise<Currency> {
    return this.currencyRepository.findById(id.toUpperCase(), filter);
  }

  @del('/currencies/{id}')
  @response(204, {
    description: 'Currency DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.currencyRepository.deleteById(id.toUpperCase());
  }
}
