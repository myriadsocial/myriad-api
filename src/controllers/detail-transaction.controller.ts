import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  put,
  requestBody,
  response
} from '@loopback/rest';
import {DetailTransaction} from '../models';
import {DetailTransactionRepository} from '../repositories';

export class DetailTransactionController {
  constructor(
    @repository(DetailTransactionRepository)
    public detailTransactionRepository: DetailTransactionRepository,
  ) { }

  @post('/detail-transactions')
  @response(200, {
    description: 'DetailTransaction model instance',
    content: {'application/json': {schema: getModelSchemaRef(DetailTransaction)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(DetailTransaction, {
            title: 'NewDetailTransaction',
            exclude: ['id'],
          }),
        },
      },
    })
    detailTransaction: Omit<DetailTransaction, 'id'>,
  ): Promise<DetailTransaction> {
    return this.detailTransactionRepository.create(detailTransaction);
  }

  @get('/detail-transactions/count')
  @response(200, {
    description: 'DetailTransaction model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(DetailTransaction) where?: Where<DetailTransaction>,
  ): Promise<Count> {
    return this.detailTransactionRepository.count(where);
  }

  @get('/detail-transactions')
  @response(200, {
    description: 'Array of DetailTransaction model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(DetailTransaction, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(DetailTransaction) filter?: Filter<DetailTransaction>,
  ): Promise<DetailTransaction[]> {
    return this.detailTransactionRepository.find(filter);
  }

  @patch('/detail-transactions')
  @response(200, {
    description: 'DetailTransaction PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(DetailTransaction, {partial: true}),
        },
      },
    })
    detailTransaction: DetailTransaction,
    @param.where(DetailTransaction) where?: Where<DetailTransaction>,
  ): Promise<Count> {
    return this.detailTransactionRepository.updateAll(detailTransaction, where);
  }

  @get('/detail-transactions/{id}')
  @response(200, {
    description: 'DetailTransaction model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(DetailTransaction, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(DetailTransaction, {exclude: 'where'}) filter?: FilterExcludingWhere<DetailTransaction>
  ): Promise<DetailTransaction> {
    return this.detailTransactionRepository.findById(id, filter);
  }

  @patch('/detail-transactions/{id}')
  @response(204, {
    description: 'DetailTransaction PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(DetailTransaction, {partial: true}),
        },
      },
    })
    detailTransaction: DetailTransaction,
  ): Promise<void> {
    await this.detailTransactionRepository.updateById(id, detailTransaction);
  }

  @put('/detail-transactions/{id}')
  @response(204, {
    description: 'DetailTransaction PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() detailTransaction: DetailTransaction,
  ): Promise<void> {
    await this.detailTransactionRepository.replaceById(id, detailTransaction);
  }

  @del('/detail-transactions/{id}')
  @response(204, {
    description: 'DetailTransaction DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.detailTransactionRepository.deleteById(id);
  }
}
