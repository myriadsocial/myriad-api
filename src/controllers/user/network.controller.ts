import {authenticate} from '@loopback/authentication';
import {intercept, service} from '@loopback/core';
import {getModelSchemaRef, patch, requestBody} from '@loopback/rest';
import {UpdateInterceptor} from '../../interceptors';
import {Credential, Wallet} from '../../models';
import {UserService} from '../../services';

@authenticate('jwt')
export class UserNetworkController {
  constructor(
    @service(UserService)
    protected userService: UserService,
  ) {}

  @intercept(UpdateInterceptor.BINDING_KEY)
  @patch('/switch-network', {
    responses: {
      '200': {
        description: 'SWITCH networks',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Wallet)},
          },
        },
      },
    },
  })
  async patch(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Credential, {exclude: ['data']}),
        },
      },
    })
    credential: Credential,
  ): Promise<Wallet> {
    return this.userService.switchNetwork(credential);
  }
}
