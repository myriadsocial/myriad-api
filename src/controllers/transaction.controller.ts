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
import {Transaction, Token, User} from '../models';
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
      
      this.detailTransactionRepository.updateById(detailTransactionId, {
        sentToThem: foundFromUser.sentToThem + value
      })
    } else {
      const foundUser = await this.userRepository.findOne({
        where: {
          id: from
        }
      })

      if (foundUser) {
        this.detailTransactionRepository.create({
          sentToMe: 0,
          sentToThem: value,
          userId: from,
          tokenId: tokenId
        })
      }
    }
    
    const foundToUser = await this.findDetailTransaction(to, tokenId)

    if (foundToUser) {
      const detailTransactionId = foundToUser.id

      this.detailTransactionRepository.updateById(detailTransactionId, {
        sentToMe: foundToUser.sentToMe + value
      })
    } else {
      const foundUser = await this.userRepository.findOne({
        where: {
          id: to
        }
      })

      if (!foundUser) {
        return this.transactionRepository.create({
          ...transaction,
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
          hasSendToUser: false
        })
      }

      this.detailTransactionRepository.create({
        sentToMe: value,
        sentToThem: 0,
        tokenId: tokenId,
        userId: to
      })
    }

    return this.transactionRepository.create({
      ...transaction,
      createdAt: new Date().toString(),
      updatedAt: new Date().toString(),
      hasSendToUser: true
    });
  }

  @get('/transactions/{id}/token', {
    responses: {
      '200': {
        description: 'Token belonging to Transaction',
        content: {
          'application/json': {
            schema: { type: 'array', items: getModelSchemaRef(Token) },
          },
        },
      },
    },
  })
  async getToken(
    @param.path.string('id') id: typeof Transaction.prototype.id,
  ): Promise<Token> {
    return this.transactionRepository.token(id);
  }

  @get('/transactions/{id}/user', {
    responses: {
      '200': {
        description: 'User belonging to Transaction',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(User)},
          },
        },
      },
    },
  })
  async getUser(
    @param.path.string('id') id: typeof Transaction.prototype.id,
  ): Promise<User> {
    return this.transactionRepository.toUser(id);
  }

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
