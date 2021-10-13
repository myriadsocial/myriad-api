import {intercept, service} from '@loopback/core';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {PaginationInterceptor} from '../interceptors';
import {Transaction} from '../models';
import {TransactionRepository} from '../repositories';
import {NotificationService} from '../services';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class TransactionController {
  constructor(
    @repository(TransactionRepository)
    protected transactionRepository: TransactionRepository,
    @service(NotificationService)
    protected notificationService: NotificationService,
  ) {}

  @post('/transactions')
  @response(200, {
    description: 'Transaction model instance',
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
    const newTransaction = await this.transactionRepository.create(
      new Transaction(transaction),
    );

    try {
      await this.notificationService.sendTipsSuccess(newTransaction);
    } catch {
      // ignore
    }

    return newTransaction;
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/transactions')
  @response(200, {
    description: 'Array of Transaction model instances',
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
    @param.filter(Transaction, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<Transaction>,
  ): Promise<Transaction[]> {
    return this.transactionRepository.find(filter);
  }

  @get('/transactions/{id}')
  @response(200, {
    description: 'Transaction model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Transaction, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Transaction, {exclude: 'where'})
    filter?: FilterExcludingWhere<Transaction>,
  ): Promise<Transaction> {
    return this.transactionRepository.findById(id, filter);
  }

  @del('/transactions/{id}')
  @response(204, {
    description: 'Transaction DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.transactionRepository.deleteById(id);
  }
}
