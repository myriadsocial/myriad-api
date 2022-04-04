import {AnyObject} from '@loopback/repository';
import {post, response, param, get} from '@loopback/rest';
import {CurrencyService, NetworkService} from '../services';
import {service} from '@loopback/core';
import {authenticate} from '@loopback/authentication';

export class TipController {
  constructor(
    @service(NetworkService)
    protected networkService: NetworkService,
    @service(CurrencyService)
    protected currencyService: CurrencyService,
  ) {}

  @authenticate('jwt')
  @post('/users/{userId}/claim/{currencyId}')
  @response(200, {
    description: 'Claim Token Tips',
  })
  async claimTips(
    @param.path.string('userId') userId: string,
    @param.path.string('currencyId') currencyId: string,
  ): Promise<void> {
    return this.currencyService.claimTips(userId, currencyId);
  }

  @get('/users/{userId}/balance/{networkId}')
  @response(200, {
    description: 'User Balance',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            currencyId: {
              type: 'string',
            },
            balance: {
              type: 'number',
            },
          },
        },
      },
    },
  })
  async getBalance(
    @param.path.string('userId') userId: string,
    @param.path.string('networkId') networkId: string,
  ): Promise<AnyObject> {
    return this.networkService.escrowBalance(userId, networkId);
  }
}
