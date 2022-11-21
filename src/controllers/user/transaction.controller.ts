import {authenticate} from '@loopback/authentication';
import {intercept, service} from '@loopback/core';
import {Filter} from '@loopback/repository';
import {
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {PaginationInterceptor} from '../../interceptors';
import {Transaction, UpdateTransactionDto} from '../../models';
import {UserService} from '../../services';

@authenticate('jwt')
export class UserTransactionController {
  constructor(
    @service(UserService)
    private userService: UserService,
  ) {}

  @post('/user/transactions')
  @response(200, {
    description: 'CREATE user transaction',
    content: {'application/json': {schema: getModelSchemaRef(Transaction)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Transaction, {
            title: 'NewTransaction',
            exclude: ['id'],
          }),
        },
      },
    })
    transaction: Omit<Transaction, 'id'>,
  ): Promise<Transaction> {
    return this.userService.createTransaction(transaction);
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/user/transactions')
  @response(200, {
    description: 'GET transactions',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Transaction, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Transaction, {exclude: ['where', 'limit', 'skip', 'offset']})
    filter?: Filter<Transaction>,
  ): Promise<Transaction[]> {
    return this.userService.transactions(filter);
  }

  @patch('/user/transactions')
  @response(204, {description: 'UPDATE user transaction'})
  async patch(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UpdateTransactionDto),
        },
      },
    })
    data: UpdateTransactionDto,
  ): Promise<void> {
    return this.userService.updateTransaction(data);
  }
}
