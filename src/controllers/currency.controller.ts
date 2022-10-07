import {intercept} from '@loopback/core';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {get, getModelSchemaRef, param, response} from '@loopback/rest';
import {PaginationInterceptor} from '../interceptors';
import {Currency} from '../models';
import {CurrencyRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
export class CurrencyController {
  constructor(
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
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
  ): Promise<Currency[]> {
    return this.currencyRepository.find(filter);
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
    return this.currencyRepository.findById(id, filter);
  }
}
