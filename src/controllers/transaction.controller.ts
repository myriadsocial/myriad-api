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
  HttpErrors,
  param,
  patch,
  post,
  put,
  requestBody,
  response
} from '@loopback/rest';
import {Transaction} from '../models';
import {
  TransactionRepository,
  UserRepository,
  DetailTransactionRepository,
  TokenRepository
} from '../repositories';

export class TransactionController {
  constructor(
    @repository(TransactionRepository)
    public transactionRepository: TransactionRepository,
    @repository(UserRepository) public userRepository: UserRepository,
    @repository(DetailTransactionRepository) public detailTransactionRepository: DetailTransactionRepository,
    @repository(TokenRepository) public tokenRepository: TokenRepository
  ) { }

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
    const foundToken = await this.tokenRepository.findOne({
      where: {
        id: transaction.tokenId
      }
    })

    if (!foundToken) {
      throw new HttpErrors.NotFound('Token not found')
    }

    const from = transaction.from
    const to = transaction.to
    const value = transaction.value
    const tokenId = transaction.tokenId

    const foundFromUser = await this.findDetailTransaction(from, tokenId) 
    
    if (foundFromUser) {
      const detailTransactionId = foundFromUser.id
      await this.detailTransactionRepository.updateById(detailTransactionId, {
        sentToThem: foundFromUser.sentToThem + value
      })
    } else {
      const foundUser = await this.userRepository.findOne({
        where: {
          id: from
        }
      })

      if (foundUser) {
        await this.detailTransactionRepository.create({
          sentToMe: 0,
          sentToThem: value,
          userId: from,
          tokenId: transaction.tokenId
        })
      }
    }

    
    const foundToUser = await this.findDetailTransaction(to, tokenId)

    if (foundToUser) {
      const detailTransactionId = foundToUser.id

      await this.detailTransactionRepository.updateById(detailTransactionId, {
        sentToMe: foundToUser.sentToMe + value
      })
    } else {
      const foundUser = await this.userRepository.findOne({
        where: {
          id: to
        }
      })

      if (foundUser) {
        await this.detailTransactionRepository.create({
          sentToMe: value,
          sentToThem: 0,
          tokenId: transaction.tokenId,
          userId: to
        })
      }
    }

    return this.transactionRepository.create({
      ...transaction,
      createdAt: new Date().toString(),
      updatedAt: new Date().toString()
    });
  }

  // @get('/transactions/count')
  // @response(200, {
  //   description: 'Transaction model count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async count(
  //   @param.where(Transaction) where?: Where<Transaction>,
  // ): Promise<Count> {
  //   return this.transactionRepository.count(where);
  // }

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
    @param.filter(Transaction) filter?: Filter<Transaction>,
  ): Promise<Transaction[]> {
    return this.transactionRepository.find(filter);
  }

  @patch('/transactions')
  @response(200, {
    description: 'Transaction PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Transaction, {partial: true}),
        },
      },
    })
    transaction: Transaction,
    @param.where(Transaction) where?: Where<Transaction>,
  ): Promise<Count> {
    return this.transactionRepository.updateAll({
      ...transaction,
      updatedAt: new Date().toString()
    }, where);
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
    @param.filter(Transaction, {exclude: 'where'}) filter?: FilterExcludingWhere<Transaction>
  ): Promise<Transaction> {
    return this.transactionRepository.findById(id, filter);
  }

  @patch('/transactions/{id}')
  @response(204, {
    description: 'Transaction PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Transaction, {partial: true}),
        },
      },
    })
    transaction: Transaction,
  ): Promise<void> {
    await this.transactionRepository.updateById(id, {
      ...transaction,
      updatedAt: new Date().toString()
    });
  }

  // @put('/transactions/{id}')
  // @response(204, {
  //   description: 'Transaction PUT success',
  // })
  // async replaceById(
  //   @param.path.string('id') id: string,
  //   @requestBody() transaction: Transaction,
  // ): Promise<void> {
  //   await this.transactionRepository.replaceById(id, transaction);
  // }

  @del('/transactions/{id}')
  @response(204, {
    description: 'Transaction DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.transactionRepository.deleteById(id);
  }

  async findDetailTransaction(userId: string, tokenId: string) {
    return this.detailTransactionRepository.findOne({
      where: {
        userId: userId,
        tokenId: tokenId
      }
    })
  }
}
