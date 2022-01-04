import {AuthenticationBindings} from '@loopback/authentication';
import {AnyObject, repository} from '@loopback/repository';
import {post, response, param, get, HttpErrors} from '@loopback/rest';
import {CurrencyService} from '../services';
import {inject, service} from '@loopback/core';
import {authenticate} from '@loopback/authentication';
import {UserProfile, securityId} from '@loopback/security';
import {UserRepository} from '../repositories';

@authenticate('jwt')
export class TipController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @service(CurrencyService)
    protected currencyService: CurrencyService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    protected currentUser: UserProfile,
  ) {}

  @post('/users/{userId}/claim/{currencyId}')
  @response(200, {
    description: 'Claim Token Tips',
  })
  async claimTips(
    @param.path.string('userId') userId: string,
    @param.path.string('currencyId') currencyId: string,
  ): Promise<void> {
    let error = false;

    if (!this.currentUser) error = true;
    if (userId !== this.currentUser[securityId]) error = true;

    const isUser = await this.userRepository.findOne({
      where: {id: this.currentUser[securityId]},
    });

    if (!isUser) error = true;

    if (error) {
      throw new HttpErrors.Forbidden('Forbidden user!');
    }

    return this.currencyService.claimTips(userId, currencyId.toUpperCase());
  }

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
