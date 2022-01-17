import {authenticate, AuthenticationBindings} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {param, get, getModelSchemaRef, HttpErrors} from '@loopback/rest';
import {Wallet, User} from '../models';
import {WalletRepository} from '../repositories';
import {UserProfile, securityId} from '@loopback/security';

@authenticate('jwt')
export class WalletUserController {
  constructor(
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
    @inject(AuthenticationBindings.CURRENT_USER)
    protected currentUser: UserProfile,
  ) {}

  @get('/wallets/{id}/user', {
    responses: {
      '200': {
        description: 'User belonging to Wallet',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(User)},
          },
        },
      },
    },
  })
  async getUser(
    @param.path.string('id') id: typeof Wallet.prototype.id,
  ): Promise<User> {
    const user = await this.walletRepository.user(id);

    if (user.id !== this.currentUser[securityId]) {
      throw new HttpErrors.Unauthorized('You are not authorized!');
    }

    return user;
  }
}
