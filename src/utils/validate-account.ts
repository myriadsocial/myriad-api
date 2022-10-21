import {Credential, Network} from '../models';
import {PolkadotJs} from './polkadotJs-utils';
import {Near} from './near-api-js';

export async function validateAccount(
  credential: Credential,
  network?: Network,
  walletId?: string,
): Promise<boolean> {
  const {walletType} = credential;

  switch (walletType) {
    case 'polkadot{.js}': {
      return PolkadotJs.signatureVerify(credential);
    }

    case 'near': {
      if (!network || !walletId) return false;

      const verifyAccessKey = await Near.verifyAccessKey(
        credential,
        network.rpcURL,
        walletId,
      );

      if (!verifyAccessKey) return false;

      return Near.signatureVerify(credential);
    }

    default:
      return false;
  }
}
