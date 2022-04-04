import {authenticate, AuthenticationBindings} from '@loopback/authentication';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {del, get, getModelSchemaRef, param, response} from '@loopback/rest';
import {User, Wallet} from '../models';
import {UserRepository, WalletRepository} from '../repositories';
import {UserProfile, securityId} from '@loopback/security';
import {inject, intercept} from '@loopback/core';
import {DeleteInterceptor, PaginationInterceptor} from '../interceptors';

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

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/wallets')
  @response(200, {
    description: 'Array of Wallet model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Wallet, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Wallet, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<Wallet>,
  ): Promise<Wallet[]> {
    return this.walletRepository.find(filter);
  }

  @get('/wallets/{id}', {
    responses: {
      '200': {
        description: 'Wallet model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Wallet, {includeRelations: true}),
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Wallet, {exclude: 'where'})
    filter?: FilterExcludingWhere<Wallet>,
  ): Promise<Wallet> {
    return this.walletRepository.findById(id, filter);
  }

  @intercept(DeleteInterceptor.BINDING_KEY)
  @del('/wallets/{id}')
  @response(204, {
    description: 'Wallet DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.walletRepository.deleteById(id);
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
    @param.filter(User, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<User>,
  ): Promise<User> {
    const wallet = await this.walletRepository.findById(id);
    return this.userRepository.findById(wallet.userId, filter);
  }
}
