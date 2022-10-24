import {authenticate} from '@loopback/authentication';
import {service} from '@loopback/core';
import {getModelSchemaRef, post, requestBody, response} from '@loopback/rest';
import {Transaction, TxDetail} from '../../models';
import {UserService} from '../../services';

@authenticate('jwt')
export class ClaimReferenceController {
  constructor(
    @service(UserService)
    private userService: UserService,
  ) {}

  @post('/claim-references')
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
