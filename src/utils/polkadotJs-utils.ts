import {ApiPromise, Keyring, WsProvider} from '@polkadot/api';
import {KeyringPair} from '@polkadot/keyring/types';
import {u8aToHex} from '@polkadot/util';
import {mnemonicGenerate} from '@polkadot/util-crypto';
import {KeypairType} from '@polkadot/util-crypto/types';

export class PolkadotJs {
  async polkadotApi(wssProvider: string): Promise<ApiPromise> {
    try {
      const provider = new WsProvider(wssProvider);
      const api = await new ApiPromise({provider}).isReadyOrError;

      return api;
    } catch (e) {
      throw new Error('LostConnection');
    }
  }

  getKeyring(type = 'sr25519', addressFormat = 42): Keyring {
    return new Keyring({
      type: type as KeypairType,
      ss58Format: addressFormat,
    });
  }

  getHexPublicKey(keyring: KeyringPair): string {
    return u8aToHex(keyring.publicKey);
  }

  generateSeed(): string {
    return mnemonicGenerate();
  }
}
