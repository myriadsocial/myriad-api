import {service} from '@loopback/core';
import {Count, CountSchema, repository} from '@loopback/repository';
import {del, getModelSchemaRef, post, requestBody} from '@loopback/rest';
import {UserCrypto} from '../models';
import {UserRepository, UserCryptoRepository} from '../repositories';
import {CryptocurrencyService} from '../services';
// import { authenticate } from '@loopback/authentication';

// @authenticate("jwt")
export class UserCryptoController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(UserCryptoRepository)
    protected userCryptoRepository: UserCryptoRepository,
    @service(CryptocurrencyService)
    protected cryptocurrencyService: CryptocurrencyService,
  ) {}

  @post('/user-cryptos', {
    responses: {
      '200': {
        description: 'create a UserCrypto model instance',
        content: {'application/json': {schema: getModelSchemaRef(UserCrypto)}},
      },
    },
  })
  async createUserCryptocurrency(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserCrypto, {
            title: 'NewUserCrypto',
          }),
        },
      },
    })
    userCrypto: UserCrypto,
  ): Promise<UserCrypto> {
    await this.cryptocurrencyService.isUserHasCrypto(
      userCrypto.userId,
      userCrypto.cryptocurrencyId,
    );

    return this.userCryptoRepository.create(userCrypto);
  }

  @del('/user-cryptos', {
    responses: {
      '200': {
        description: 'User.Cryptocurrency DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserCrypto, {
            title: 'NewUserCrypto',
          }),
        },
      },
    })
    userCrypto: UserCrypto,
  ): Promise<Count> {
    return this.userCryptoRepository.deleteAll({
      userId: userCrypto.userId,
      cryptocurrencyId: userCrypto.cryptocurrencyId,
    });
  }
}
