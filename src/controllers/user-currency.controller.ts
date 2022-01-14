import {intercept} from '@loopback/core';
import {Count, CountSchema, Filter, repository} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {
  PaginationInterceptor,
  ValidateCurrencyInterceptor,
} from '../interceptors';
import {UserCurrency} from '../models';
import {UserCurrencyRepository, UserRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';

interface UserCurrencyPriority {
  userId: string;
  currencies: string[];
}

@authenticate('jwt')
export class UserCurrencyController {
  constructor(
    @repository(UserCurrencyRepository)
    protected userCurrencyRepository: UserCurrencyRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/user-currencies')
  @response(200, {
    description: 'Array of User Currency model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(UserCurrency, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(UserCurrency, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<UserCurrency>,
  ): Promise<UserCurrency[]> {
    return this.userCurrencyRepository.find(filter);
  }

  @intercept(ValidateCurrencyInterceptor.BINDING_KEY)
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
