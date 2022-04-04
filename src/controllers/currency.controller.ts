import {inject, intercept} from '@loopback/core';
import {
  AnyObject,
  Filter,
  FilterExcludingWhere,
  repository,
} from '@loopback/repository';
import {
  get,
  getModelSchemaRef,
  HttpErrors,
  param,
  post,
  response,
} from '@loopback/rest';
import {PaginationInterceptor} from '../interceptors';
import {Currency} from '../models';
import {CurrencyRepository, WalletRepository} from '../repositories';
import {authenticate, AuthenticationBindings} from '@loopback/authentication';
import {UserProfile, securityId} from '@loopback/security';
import {omit} from 'lodash';

export class CurrencyController {
  constructor(
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    protected currentUser: UserProfile,
  ) {}

  @authenticate('jwt')
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

  @authenticate('jwt')
  @post('/currencies/{currencyId}/default')
  @response(200, {
    description: 'Default currency',
  })
  async defaultCurrency(
    @param.path.string('currencyId') currencyId: string,
  ): Promise<Currency> {
    const wallet = await this.walletRepository.findOne({
      where: {
        userId: this.currentUser[securityId],
        primary: true,
      },
    });

    if (!wallet) {
      throw new HttpErrors.UnprocessableEntity('Wallet not exists');
    }

    const currency = await this.currencyRepository.findById(currencyId);

    if (currency.networkId !== wallet.network) {
      throw new HttpErrors.UnprocessableEntity('Currency not exists');
    }

    const currentCurrency = await this.currencyRepository.findOne(<AnyObject>{
      where: {
        networkId: wallet.network,
        [`defaultUserCurrency.${this.currentUser[securityId]}`]: 1,
      },
    });

    if (currentCurrency) {
      const currentDefault = currentCurrency.defaultUserCurrency;
      await this.currencyRepository.updateById(currentCurrency.id, {
        defaultUserCurrency: omit(currentDefault, [
          this.currentUser[securityId],
        ]),
      });
    }

    const updatedDefault = currency?.defaultUserCurrency ?? {};
    updatedDefault[this.currentUser[securityId]] = 1;

    await this.currencyRepository.updateById(currencyId, {
      defaultUserCurrency: updatedDefault,
    });

    return currency;
  }
}
