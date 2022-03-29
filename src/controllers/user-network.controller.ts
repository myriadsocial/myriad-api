import {authenticate} from '@loopback/authentication';
import {intercept} from '@loopback/core';
import {Count, repository} from '@loopback/repository';
import {getModelSchemaRef, param, patch, requestBody} from '@loopback/rest';
import {UpdateInterceptor} from '../interceptors';
import {Credential, Wallet} from '../models';
import {UserRepository} from '../repositories';
import {omit} from 'lodash';

@authenticate('jwt')
export class UserNetworkController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
  ) {}

  @intercept(UpdateInterceptor.BINDING_KEY)
  @patch('/users/{id}/networks', {
    responses: {
      '200': {
        description: 'Change user network',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Wallet)},
          },
        },
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Credential, {exclude: ['data']}),
        },
      },
    })
    credential: Credential,
  ): Promise<Count> {
    return this.userRepository
      .wallets(id)
      .patch(omit(credential.data, ['id']), {id: credential.data.id});
  }
}
