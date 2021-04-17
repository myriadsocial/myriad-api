import {ApiPromise, WsProvider} from '@polkadot/api';

export async function polkadotApi ():Promise<ApiPromise> {
  const wsProvider = new WsProvider('wss://rpc.myriad.systems')
  const api = await ApiPromise.create({provider: wsProvider})

  return api
}