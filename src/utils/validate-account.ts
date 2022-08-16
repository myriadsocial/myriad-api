import {Credential, Network} from '../models';
import {PolkadotJs} from './polkadotJs-utils';
import {Near} from './near-api-js';

export async function validateAccount(
  credential: Credential,
  network?: Network,
  walletId?: string,
  caller?: string,
): Promise<boolean> {
  const {walletType} = credential;

  switch (walletType) {
    case 'polkadot{.js}': {
      return PolkadotJs.signatureVerify(credential);
    }

    case 'near': {
      console.log(`[validate] [${caller}] credential`, `${JSON.stringify(credential)}`)

      if (!network || !walletId) {
        console.log(`[validate] [${caller}] network`, `${JSON.stringify(network)}`)
        console.log(`[validate] [${caller}] walletId`, `${walletId}`)
        return false;
      }

      const verifyAccessKey = await Near.verifyAccessKey(
        credential,
        network.rpcURL,
        walletId,
        caller
      );

      if (!verifyAccessKey) return false;

      return Near.signatureVerify(credential);
    }

    default:
      return false;
  }
}
