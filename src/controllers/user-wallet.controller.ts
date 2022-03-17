import {authenticate} from '@loopback/authentication';
import {intercept} from '@loopback/core';
import {Count, Filter, repository} from '@loopback/repository';
import {get, getModelSchemaRef, param, post, requestBody} from '@loopback/rest';
import {CreateInterceptor, PaginationInterceptor} from '../interceptors';
import {Credential, User, Wallet} from '../models';
import {UserRepository, WalletRepository} from '../repositories';
import {omit} from 'lodash';

@authenticate('jwt')
export class UserWalletController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/users/{id}/wallets', {
    responses: {
      '200': {
        description: 'Array of User has many Wallet',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Wallet)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Wallet>,
  ): Promise<Wallet[]> {
    return this.userRepository.wallets(id).find(filter);
  }

  @intercept(CreateInterceptor.BINDING_KEY)
  @post('/users/{id}/wallets', {
    responses: {
      '200': {
        description: 'Connect new wallet',
        content: {'application/json': {schema: getModelSchemaRef(Wallet)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof User.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Credential),
        },
      },
    })
    credential: Credential,
  ): Promise<Wallet | Count> {
    if (credential.data.updated) {
      const {network, networks, primary} = credential.data;
      return this.userRepository
        .wallets(id)
        .patch({network, networks, primary}, {id: credential.data.id});
    }

    return this.userRepository
      .wallets(id)
      .create(omit(credential.data, ['updated']));
  }
}
