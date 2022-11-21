import {authenticate} from '@loopback/authentication';
import {intercept, service} from '@loopback/core';
import {Filter} from '@loopback/repository';
import {
  get,
  getModelSchemaRef,
  param,
  patch,
  requestBody,
  response,
} from '@loopback/rest';
import {PaginationInterceptor} from '../../interceptors';
import {Priority, UserCurrency} from '../../models';
import {UserService} from '../../services';

@authenticate('jwt')
export class UserCurrencyController {
  constructor(
    @service(UserService)
    private userService: UserService,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/user/currencies')
  @response(200, {
    description: 'GET user currencies',
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
    return this.userService.currencies(filter);
  }

  @patch('/user/currencies')
  @response(204, {description: 'SET user currency prioroty'})
  async patch(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Priority),
        },
      },
    })
    priority: Priority,
  ): Promise<void> {
    return this.userService.setCurrencyPriority(priority);
  }
}
