import {authenticate} from '@loopback/authentication';
import {service} from '@loopback/core';
import {get, param, response} from '@loopback/rest';
import {ReferenceType} from '../enums';
import {
  TipsBalanceInfo,
  WalletAddressService,
} from '../services/wallet-address.service';

@authenticate('jwt')
export class WalletAddressController {
  constructor(
    @service(WalletAddressService)
    private walletAddressService: WalletAddressService,
  ) {}

  @get('/{kind}/{id}/walletaddress')
  @response(200, {
    description: 'Reference model wallet address',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            serverId: {
              type: 'string',
            },
            referenceType: {
              type: 'string',
            },
            referenceId: {
              type: 'string',
            },
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('kind') kind: ReferenceType,
    @param.path.string('id') id: string,
  ): Promise<TipsBalanceInfo> {
    return this.walletAddressService.findById(id, kind);
  }
}
