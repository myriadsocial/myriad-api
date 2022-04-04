import {authenticate} from '@loopback/authentication';
import {intercept} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  getModelSchemaRef,
  param,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {CreateInterceptor} from '../interceptors';
import {Currency} from '../models';
import {NetworkRepository} from '../repositories';

@authenticate('jwt')
export class NetworkCurrencyController {
  constructor(
    @repository(NetworkRepository)
    protected networkRepository: NetworkRepository,
  ) {}

  @intercept(CreateInterceptor.BINDING_KEY)
  @post('/networks/{id}/currency')
  @response(200, {
    description: 'Currency model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Currency),
      },
    },
  })
  async create(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Currency, {
            title: 'NewCurrency',
            exclude: [
              'id',
              'name',
              'image',
              'symbol',
              'native',
              'exchangeRate',
            ],
            optional: ['networkId'],
          }),
        },
      },
    })
    currency: Omit<Currency, 'id'>,
  ): Promise<Currency> {
    return this.networkRepository.currencies(id).create(currency);
  }
}
