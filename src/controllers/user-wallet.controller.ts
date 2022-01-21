import {authenticate} from '@loopback/authentication';
import {intercept} from '@loopback/core';
import {Count, CountSchema, Filter, repository} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  HttpErrors,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import {
  AuthorizeInterceptor,
  DeleteInterceptor,
  PaginationInterceptor,
  UpdateInterceptor,
} from '../interceptors';
import {User, Wallet} from '../models';
import {UserRepository} from '../repositories';

@authenticate('jwt')
@intercept(AuthorizeInterceptor.BINDING_KEY)
export class UserWalletController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
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

  @post('/users/{id}/wallets', {
    responses: {
      '200': {
        description: 'User model instance',
        content: {'application/json': {schema: getModelSchemaRef(Wallet)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof User.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Wallet, {
            title: 'NewWalletInUser',
            optional: ['userId'],
            exclude: ['primary'],
          }),
        },
      },
    })
    wallet: Wallet,
  ): Promise<Wallet> {
    return this.userRepository.wallets(id).create(wallet);
  }

  @intercept(UpdateInterceptor.BINDING_KEY)
  @patch('/users/{userId}/wallets/{walletId}', {
    responses: {
      '200': {
        description: 'User.Wallet PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('userId') userId: string,
    @param.path.string('walletId') walletId: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Wallet, {
            partial: true,
            exclude: ['type', 'userId', 'platform'],
          }),
        },
      },
    })
    wallet: Partial<Wallet>,
  ): Promise<Count> {
    return this.userRepository.wallets(userId).patch(wallet, {
      id: walletId,
    });
  }

  @intercept(DeleteInterceptor.BINDING_KEY)
  @del('/users/{userId}/wallets/{walletId}', {
    responses: {
      '200': {
        description: 'User.Wallet DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('userId') userId: string,
    @param.path.string('walletId') walletId: string,
  ): Promise<Count> {
    const wallets = await this.userRepository.wallets(userId).find({limit: 2});

    if (wallets.length === 1) {
      throw new HttpErrors.UnprocessableEntity(
        'You cannot remove your wallet!',
      );
    }

    return this.userRepository.wallets(userId).delete({id: walletId});
  }
}
