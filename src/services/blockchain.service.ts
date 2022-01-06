import {injectable, /* inject, */ BindingScope} from '@loopback/core';
import {ApiPromise, WsProvider} from '@polkadot/api';
import Web3 from 'web3';

@injectable({scope: BindingScope.TRANSIENT})
export class BlockchainService {
  constructor(/* Add @inject to inject parameters */) {}

  async createPolkadotProvider(rpcAddress: string): Promise<ApiPromise> {
    const wsProvider = new WsProvider(rpcAddress);
    return ApiPromise.create({ provider: wsProvider });
  }

  async createWeb3Provider(rpcAddress: string): Promise<Web3> {
    return new Web3(rpcAddress);
  }
}
