import {inject, service} from '@loopback/core';
import {get, param, response} from '@loopback/rest';
import {
  CommentTransactionSummary,
  PostTransactionSummary,
  UserTransactionSummary,
} from '../interfaces';
import {TransactionService} from '../services';
import {authenticate} from '@loopback/authentication';
import {LoggingBindings, logInvocation, WinstonLogger} from '@loopback/logging';

@authenticate('jwt')
export class TransactionSummaryController {
  // Inject a winston logger
  @inject(LoggingBindings.WINSTON_LOGGER)
  private logger: WinstonLogger;

  constructor(
    @service(TransactionService)
    protected transactionService: TransactionService,
  ) {}

  @logInvocation()
  @get('/users/{id}/transaction-summary')
  @response(200, {
    description: 'Transaction Summary of User model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sent: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    currencyId: {
                      type: 'string',
                    },
                    amount: {
                      type: 'number',
                    },
                  },
                },
              },
              received: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    currencyId: {
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
        },
      },
    },
  })
  async userTransactionSummary(
    @param.path.string('id') id: string,
  ): Promise<UserTransactionSummary> {
    const totalAmount = await Promise.all(
      ['from', 'to'].map(e => {
        return this.transactionService.totalTransactionAmount(
          e,
          id,
          '$currencyId',
        );
      }),
    );

    return {
      sent: totalAmount[0],
      received: totalAmount[1],
    };
  }

  @logInvocation()
  @get('/posts/{id}/transaction-summary')
  @response(200, {
    description: 'Transaction Summary of Post model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              currencyId: {
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
  async postTransactionSummary(
    @param.path.string('id') id: string,
  ): Promise<PostTransactionSummary> {
    return this.transactionService.totalTransactionAmount(
      'referenceId',
      id,
      '$currencyId',
    );
  }

  @logInvocation()
  @get('/comments/{id}/transaction-summary')
  @response(200, {
    description: 'Transaction Summary of Comment model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              currencyId: {
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
  async commentTransactionSummary(
    @param.path.string('id') id: string,
  ): Promise<CommentTransactionSummary> {
    return this.transactionService.totalTransactionAmount(
      'referenceId',
      id,
      '$currencyId',
    );
  }
}
