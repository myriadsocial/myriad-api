import {intercept} from '@loopback/core';
import {Count, CountSchema, repository} from '@loopback/repository';
import {
  del,
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {ValidateCurrencyInterceptor} from '../interceptors';
import {UserCurrency} from '../models';
import {UserCurrencyRepository, UserRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
export class UserCurrencyController {
  constructor(
    @repository(UserCurrencyRepository)
    protected userCurrencyRepository: UserCurrencyRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
  ) {}

  @intercept(ValidateCurrencyInterceptor.BINDING_KEY)
  @post('/user-currencies', {
    responses: {
      '200': {
        description: 'create a UserCurrency model instance',
        content: {
          'application/json': {schema: getModelSchemaRef(UserCurrency)},
        },
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserCurrency, {
            title: 'NewUserCurrency',
            exclude: ['id', 'createdAt', 'updatedAt', 'deletedAt'],
          }),
        },
      },
    })
    userCurrency: UserCurrency,
  ): Promise<UserCurrency> {
    return this.userCurrencyRepository.create(userCurrency);
  }

  @intercept(ValidateCurrencyInterceptor.BINDING_KEY)
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
            exclude: ['id', 'createdAt', 'updatedAt', 'deletedAt'],
          }),
        },
      },
    })
    userCurrency: UserCurrency,
  ): Promise<Count> {
    return this.userCurrencyRepository.deleteAll({
      userId: userCurrency.userId,
      currencyId: userCurrency.currencyId,
    });
  }

  @patch('/users/{userId}/select-currency/{currencyId}')
  @response(204, {
    description: 'User PATCH default Currency success',
  })
  async selectCurrency(
    @param.path.string('userId') userId: string,
    @param.path.string('currencyId') currencyId: string,
  ): Promise<void> {
    await this.userRepository.updateById(userId, {
      defaultCurrency: currencyId,
      updatedAt: new Date().toString(),
    });
  }
}
