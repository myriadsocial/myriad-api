import {authenticate} from '@loopback/authentication';
import {intercept} from '@loopback/core';
import {repository} from '@loopback/repository';
import {getModelSchemaRef, param, post, requestBody} from '@loopback/rest';
import {CreateInterceptor} from '../interceptors';
import {Credential, Wallet} from '../models';
import {UserRepository} from '../repositories';

@authenticate('jwt')
export class UserNetworkController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
  ) {}

  @intercept(CreateInterceptor.BINDING_KEY)
  @post('/users/{id}/networks', {
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
  async find(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Credential, {exclude: ['data']}),
        },
      },
    })
    credential: Credential,
  ): Promise<Wallet> {
    return new Wallet(credential.data);
  }
}
