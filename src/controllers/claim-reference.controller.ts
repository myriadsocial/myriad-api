import {authenticate} from '@loopback/authentication';
import {service} from '@loopback/core';
import {getModelSchemaRef, post, requestBody, response} from '@loopback/rest';
import {Transaction} from '../interfaces';
import {ClaimReference} from '../models';
import {NetworkService} from '../services';

@authenticate('jwt')
export class ClaimReferenceController {
  constructor(
    @service(NetworkService)
    protected networkService: NetworkService,
  ) {}

  @post('/claim-references')
  @response(200, {
    description: 'Claim Reference',
  })
  async claim(
    @requestBody({
      'application/json': {
        schema: getModelSchemaRef(ClaimReference),
      },
    })
    claimReference: ClaimReference,
  ): Promise<Transaction> {
    return this.networkService.claimReference(claimReference);
  }
}
