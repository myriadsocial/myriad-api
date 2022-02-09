import {intercept} from '@loopback/core';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  post,
  requestBody,
  response,
  patch,
} from '@loopback/rest';
import {
  CreateInterceptor,
  PaginationInterceptor,
  UpdateInterceptor,
} from '../interceptors';
import {Currency} from '../models';
import {CurrencyRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';
import {PermissionKeys} from '../enums';

@authenticate({strategy: 'jwt', options: {required: [PermissionKeys.ADMIN]}})
export class CurrencyController {
  constructor(
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
  ) {}

  @intercept(CreateInterceptor.BINDING_KEY)
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

  @authenticate.skip()
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

  @authenticate.skip()
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

  @intercept(UpdateInterceptor.BINDING_KEY)
  @patch('/currencies/{id}')
  @response(204, {
    description: 'Currency PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Currency, {
            partial: true,
            exclude: ['id'],
          }),
        },
      },
    })
    currency: Partial<Currency>,
  ): Promise<void> {
    await this.currencyRepository.updateById(id, currency);
  }

  @del('/currencies/{id}')
  @response(204, {
    description: 'Currency DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.currencyRepository.deleteById(id);
  }
}
