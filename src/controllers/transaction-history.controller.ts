import {service} from '@loopback/core';
import {get, param, response} from '@loopback/rest';
import {PostTransactionHistory, UserTransactionHistory} from '../interfaces';
import {TransactionService} from '../services';

export class TransactionHistoryController {
  constructor(
    @service(TransactionService)
    protected transactionService: TransactionService,
  ) {}

  @get('/users/{id}/transaction-histories')
  @response(200, {
    description: 'Transaction History of User model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              _id: {
                type: 'string',
              },
              amount: {
                type: 'number',
              },
            },
          },
        },
      },
    },
  })
  async userTransactionHistory(
    @param.path.string('id') id: string,
  ): Promise<UserTransactionHistory> {
    const totalAmountSent = await this.transactionService.totalTransactionAmount(
      'from',
      id,
      '$currencyId',
    );
    const totalAmountReceived = await this.transactionService.totalTransactionAmount(
      'to',
      id,
      '$currencyId',
    );

    return {
      sent: totalAmountSent,
      received: totalAmountReceived,
    };
  }

  @get('/posts/{id}/transaction-histories')
  @response(200, {
    description: 'Transaction History of Post model instances',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
            },
            amount: {
              type: 'number',
            },
          },
        },
      },
    },
  })
  async postTransactionHistory(
    @param.path.string('id') id: string,
  ): Promise<PostTransactionHistory> {
    return this.transactionService.totalTransactionAmount('postId', id, '$currencyId');
  }
}
