import {authenticate} from '@loopback/authentication';
import {intercept} from '@loopback/core';
import {Filter, repository} from '@loopback/repository';
import {
  getModelSchemaRef,
  requestBody,
  patch,
  get,
  response,
  param,
} from '@loopback/rest';
import {PaginationInterceptor, UpdateInterceptor} from '../interceptors';
import {UserCurrency} from '../models';
import {UserCurrencyRepository} from '../repositories';

interface UserCurrencyPriority {
  currencyIds: string[];
  userId?: string;
  networkId?: string;
}

@authenticate('jwt')
export class UserCurrencyController {
  constructor(
    @repository(UserCurrencyRepository)
    public userCurrencyRepository: UserCurrencyRepository,
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

  @intercept(UpdateInterceptor.BINDING_KEY)
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
  async patch(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              networkId: {
                type: 'string',
              },
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
    const {userId, networkId, currencyIds} = currencyPriority;

    await Promise.all(
      currencyIds.map(async (currencyId, index) => {
        return this.userCurrencyRepository.updateAll(
          {priority: index + 1},
          {
            userId: userId,
            currencyId: currencyId,
            networkId: networkId,
          },
        );
      }),
    );
  }
}
