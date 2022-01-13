import {inject, intercept} from '@loopback/core';
import {Count, CountSchema, repository} from '@loopback/repository';
import {del, getModelSchemaRef, patch, post, requestBody} from '@loopback/rest';
import {ValidateCurrencyInterceptor} from '../interceptors';
import {UserCurrency} from '../models';
import {UserCurrencyRepository, UserRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';
import {LoggingBindings, logInvocation, WinstonLogger} from '@loopback/logging';

interface UserCurrencyPriority {
  userId: string;
  currencies: string[];
}

@authenticate('jwt')
export class UserCurrencyController {
  // Inject a winston logger
  @inject(LoggingBindings.WINSTON_LOGGER)
  private logger: WinstonLogger;

  constructor(
    @repository(UserCurrencyRepository)
    protected userCurrencyRepository: UserCurrencyRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
  ) {}

  @intercept(ValidateCurrencyInterceptor.BINDING_KEY)
  @logInvocation()
  @post('/user-currencies', {
    responses: {
      '200': {
        description: 'create a UserCurrency model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(UserCurrency, {exclude: ['priority']}),
          },
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

  @logInvocation()
  @patch('/user-currencies', {
    responses: {
      '200': {
        description: 'create a UserCurrency model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(UserCurrency, {exclude: ['priority']}),
          },
        },
      },
    },
  })
  async update(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              userId: {
                type: 'string',
              },
              currencies: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    })
    currencyPriority: UserCurrencyPriority,
  ): Promise<void> {
    const {userId, currencies} = currencyPriority;

    await Promise.all(
      currencies.map(async (currency, index) => {
        return this.userCurrencyRepository.updateAll(
          {
            userId: userId,
            currencyId: currency,
            priority: index + 1,
            updatedAt: new Date().toString(),
          },
          {
            userId: userId,
            currencyId: currency,
          },
        );
      }),
    );

    await this.userRepository.updateById(userId, {
      defaultCurrency: currencies[0],
    });
  }

  @intercept(ValidateCurrencyInterceptor.BINDING_KEY)
  @logInvocation()
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
}
