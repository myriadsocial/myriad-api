import {ApiPromise, WsProvider} from '@polkadot/api';

export async function polkadotApi(): Promise<ApiPromise> {
  try {
    const provider = new WsProvider('wss://rpc.myriad.systems')
    const api = await new ApiPromise({provider}).isReadyOrError

    return api
  } catch (e) {
    throw new Error('LostConnection')
  }
}
