import {intercept} from '@loopback/core';
import {Count, CountSchema, repository} from '@loopback/repository';
import {del, getModelSchemaRef, post, requestBody} from '@loopback/rest';
import {ValidateCurrencyInterceptor} from '../interceptors';
import {UserCurrency} from '../models';
import {UserCurrencyRepository} from '../repositories';
// import { authenticate } from '@loopback/authentication';

// @authenticate("jwt")
export class UserCurrencyController {
  constructor(
    @repository(UserCurrencyRepository)
    protected userCurrencyRepository: UserCurrencyRepository,
  ) {}

  @intercept(ValidateCurrencyInterceptor.BINDING_KEY)
  @post('/user-currencies', {
    responses: {
      '200': {
        description: 'create a UserCurrency model instance',
        content: {'application/json': {schema: getModelSchemaRef(UserCurrency)}},
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserCurrency, {
            title: 'NewUserCurrency',
          }),
        },
      },
    })
    userCurrency: UserCurrency,
  ): Promise<UserCurrency> {
    return this.userCurrencyRepository.create(userCurrency);
  }

  @del('/user-currencies', {
    responses: {
      '200': {
        description: 'User.Cryptocurrency DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserCurrency, {
            title: 'NewUserCurrency',
          }),
        },
      },
    })
    userCurrency: UserCurrency,
  ): Promise<Count> {
    return this.userCurrencyRepository.deleteAll({
      userId: userCurrency.userId,
      currencyId: userCurrency.currencyId.toUpperCase(),
    });
  }
}
