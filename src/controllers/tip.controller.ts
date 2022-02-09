import {AnyObject, repository} from '@loopback/repository';
import {post, response, param, get} from '@loopback/rest';
import {CurrencyService} from '../services';
import {service} from '@loopback/core';
import {authenticate} from '@loopback/authentication';
import {UserRepository} from '../repositories';

@authenticate('jwt')
export class TipController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @service(CurrencyService)
    protected currencyService: CurrencyService,
  ) {}

  @post('/users/{userId}/claim/{currencyId}')
  @response(200, {
    description: 'Claim Token Tips',
  })
  async claimTips(
    @param.path.string('userId') userId: string,
    @param.path.string('currencyId') currencyId: string,
  ): Promise<void> {
    return this.currencyService.claimTips(userId, currencyId.toUpperCase());
  }

  @authenticate.skip()
  @get('/users/{userId}/balance/{currencyId}')
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
    @param.path.string('currencyId') currencyId: string,
  ): Promise<AnyObject> {
    return this.currencyService.getBalance(userId, currencyId.toUpperCase());
  }
}
