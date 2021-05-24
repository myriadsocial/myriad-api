import {ApiPromise, WsProvider} from '@polkadot/api';

export async function polkadotApi(wssProvider:string): Promise<ApiPromise> {
  try {
    const provider = new WsProvider(wssProvider)
    const api = await new ApiPromise({provider}).isReadyOrError

    return api
  } catch (e) {
    throw new Error('LostConnection')
  }
}
