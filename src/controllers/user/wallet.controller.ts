import {authenticate} from '@loopback/authentication';
import {intercept, service} from '@loopback/core';
import {Filter} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {PaginationInterceptor} from '../../interceptors';
import {UserToken} from '../../interfaces';
import {Credential, Wallet} from '../../models';
import {UserService} from '../../services';

@authenticate('jwt')
export class UserWalletController {
  constructor(
    @service(UserService)
    private userService: UserService,
  ) {}

  @get('/user/wallet')
  @response(200, {
    description: 'GET current user wallet',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Wallet, {includeRelations: true}),
      },
    },
  })
  async getCurrentWallet(): Promise<Wallet> {
    return this.userService.currentWallet();
  }

  @del('/user/wallets/{id}')
  @response(204, {
    description: 'DELETE user wallet',
  })
  async deleteById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Credential),
        },
      },
    })
    credential: Credential,
  ): Promise<void> {
    return this.userService.removeWallet(id, credential);
  }

  @post('/user/connect-wallet')
  @response(200, {
    description: 'CONNECT new wallet',
    content: {'application/json': {schema: getModelSchemaRef(Wallet)}},
  })
  async connectWallet(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Credential),
        },
      },
    })
    credential: Credential,
  ): Promise<UserToken | void> {
    return this.userService.connectWallet(credential);
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/users/{id}/wallets')
  @response(200, {
    description: 'GET user wallets',
    content: {
      'application/json': {
        schema: {type: 'array', items: getModelSchemaRef(Wallet)},
      },
    },
  })
  async getUserWallet(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Wallet>,
  ): Promise<Wallet[]> {
    return this.userService.wallets(id, filter);
  }
}
