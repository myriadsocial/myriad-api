import {authenticate, AuthenticationBindings} from '@loopback/authentication';
import {FilterExcludingWhere, repository} from '@loopback/repository';
import {get, getModelSchemaRef, param} from '@loopback/rest';
import {User, Wallet} from '../models';
import {UserRepository, WalletRepository} from '../repositories';
import {UserProfile, securityId} from '@loopback/security';
import {inject} from '@loopback/core';

export class WalletController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    protected currentUser: UserProfile,
  ) {}

  @authenticate('jwt')
  @get('/wallet', {
    responses: {
      '200': {
        description: 'User belonging to Wallet',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Wallet, {includeRelations: true}),
          },
        },
      },
    },
  })
  async getUserWallet(): Promise<Wallet | null> {
    return this.walletRepository.findOne({
      where: {
        primary: true,
        userId: this.currentUser[securityId],
      },
      include: ['user'],
    });
  }

  @get('/wallets/{id}/user', {
    responses: {
      '200': {
        description: 'User belonging to Wallet',
        content: {
          'application/json': {
            schema: getModelSchemaRef(User, {includeRelations: true}),
          },
        },
      },
    },
  })
  async getUser(
    @param.path.string('id') id: string,
    @param.filter(User, {exclude: 'where'}) filter?: FilterExcludingWhere<User>,
  ): Promise<User> {
    const {userId} = await this.walletRepository.findById(id);

    return this.userRepository.findById(userId, filter);
  }
}
