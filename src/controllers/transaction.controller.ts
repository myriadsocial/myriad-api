import {service} from '@loopback/core';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {del, get, getModelSchemaRef, param, post, requestBody, response} from '@loopback/rest';
import {Transaction, TransactionHistory} from '../models';
import {
  CryptocurrencyRepository,
  PostTipRepository,
  TransactionRepository,
  UserRepository,
} from '../repositories';
import {CryptocurrencyService, TransactionService} from '../services';
import dotenv from 'dotenv';
// import {authenticate} from '@loopback/authentication';

dotenv.config();

// @authenticate("jwt")
export class TransactionController {
  constructor(
    @repository(TransactionRepository)
    protected transactionRepository: TransactionRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(CryptocurrencyRepository)
    protected cryptocurrencyRepository: CryptocurrencyRepository,
    @repository(PostTipRepository)
    protected postTipRepository: PostTipRepository,
    @service(CryptocurrencyService)
    protected cryptocurrencyService: CryptocurrencyService,
    @service(TransactionService)
    protected transactionService: TransactionService,
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
    // TODO: Create transaction history
    // TODO: Send Myriad Reward
    // TODO: Update person total tip if user does not exist
    // TODO: Update post total tips

    const {from, to, value, cryptocurrencyId, postId} = transaction;

    // Validate if crypto already exist
    await this.cryptocurrencyRepository.findById(transaction.cryptocurrencyId.toUpperCase());

    // Validate if user FROM exist
    await this.userRepository.findById(transaction.from);

    // Validate if post exist
    // And count total tip in person and post
    const isPeopleTipUpdated = await this.transactionService.isTotalTipInPersonUpdated(
      transaction.to,
      postId,
      cryptocurrencyId,
      value,
    );

    // Reward to FROM for doing transactions
    this.cryptocurrencyService.sendMyriadReward(transaction.from) as Promise<void>;

    // record transaction history of FROM
    this.transactionService.recordTransactionHistory({
      sentToThem: value,
      sentToMe: 0,
      userId: from,
      cryptocurrencyId: cryptocurrencyId,
    } as Omit<TransactionHistory, 'id'>) as Promise<void>;

    transaction.createdAt = new Date().toString();
    transaction.updatedAt = new Date().toString();

    // If tip is sent to people, set hasSentToUser to false
    if (isPeopleTipUpdated) {
      transaction.hasSentToUser = false;
      return this.transactionRepository.create(transaction);
    }

    // record transaction of TO
    this.transactionService.recordTransactionHistory({
      sentToThem: 0,
      sentToMe: value,
      userId: to,
      cryptocurrencyId: cryptocurrencyId,
    } as Omit<TransactionHistory, 'id'>) as Promise<void>;

    transaction.hasSentToUser = true;
    return this.transactionRepository.create(transaction);
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
  async find(@param.filter(Transaction) filter?: Filter<Transaction>): Promise<Transaction[]> {
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
