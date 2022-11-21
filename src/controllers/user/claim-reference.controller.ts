import {authenticate} from '@loopback/authentication';
import {service} from '@loopback/core';
import {
  get,
  getModelSchemaRef,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {Transaction, TxDetail} from '../../models';
import {UserService} from '../../services';

@authenticate('jwt')
export class UserClaimReferenceController {
  constructor(
    @service(UserService)
    private userService: UserService,
  ) {}

  @get('/user/tip-status')
  @response(200, {
    description: 'GET user tip status',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            status: {
              type: 'boolean',
            },
          },
        },
      },
    },
  })
  async getTipStatus(): Promise<{status: boolean}> {
    return this.userService.tipStatus();
  }

  @post('/user/claim-references')
  @response(200, {
    description: 'Claim Reference',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Transaction),
      },
    },
  })
  async claim(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(TxDetail),
        },
      },
    })
    txDetail: TxDetail,
  ): Promise<Pick<Transaction, 'hash'>> {
    return this.userService.claimReference(txDetail);
  }
}
