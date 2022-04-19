import {repository} from '@loopback/repository';
import {param, get, getModelSchemaRef} from '@loopback/rest';
import {Wallet, Network} from '../models';
import {WalletRepository} from '../repositories';

export class WalletNetworkController {
  constructor(
    @repository(WalletRepository)
    public walletRepository: WalletRepository,
  ) {}

  @get('/wallets/{id}/network', {
    responses: {
      '200': {
        description: 'Network belonging to Wallet',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Network)},
          },
        },
      },
    },
  })
  async getNetwork(
    @param.path.string('id') id: typeof Wallet.prototype.id,
  ): Promise<Network> {
    return this.walletRepository.network(id);
  }
}
