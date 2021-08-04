import {intercept} from '@loopback/core';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {del, get, getModelSchemaRef, param, patch, requestBody, response} from '@loopback/rest';
import {defaultFilterQuery} from '../helpers/filter-utils';
import {PaginationInterceptor} from '../interceptors';
import {TransactionHistory} from '../models';
import {TransactionHistoryRepository} from '../repositories';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
@intercept(PaginationInterceptor.BINDING_KEY)
export class TransactionHistoryController {
  constructor(
    @repository(TransactionHistoryRepository)
    public transactionHistoryRepository: TransactionHistoryRepository,
  ) {}

  @get('/transaction-histories')
  @response(200, {
    description: 'Array of TransactionHistory model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(TransactionHistory, {
            includeRelations: true,
          }),
        },
      },
    },
  })
  async find(
    @param.query.number('page') page: number,
    @param.filter(TransactionHistory, {exclude: ['skip', 'offset']})
    filter?: Filter<TransactionHistory>,
  ): Promise<TransactionHistory[]> {
    filter = defaultFilterQuery(page);
    return this.transactionHistoryRepository.find(filter);
  }

  @get('/transaction-histories/{id}')
  @response(200, {
    description: 'TransactionHistory model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(TransactionHistory, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(TransactionHistory, {exclude: 'where'})
    filter?: FilterExcludingWhere<TransactionHistory>,
  ): Promise<TransactionHistory> {
    return this.transactionHistoryRepository.findById(id, filter);
  }

  @patch('/transaction-histories/{id}')
  @response(204, {
    description: 'TransactionHistory PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(TransactionHistory, {partial: true}),
        },
      },
    })
    transactionHistory: TransactionHistory,
  ): Promise<void> {
    transactionHistory.updatedAt = new Date().toString();
    await this.transactionHistoryRepository.updateById(id, transactionHistory);
  }

  @del('/transaction-histories/{id}')
  @response(204, {
    description: 'TransactionHistory DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.transactionHistoryRepository.deleteById(id);
  }
}
