import {ApiPromise, Keyring, WsProvider} from '@polkadot/api';
import {KeyringPair} from '@polkadot/keyring/types';
import {u8aToHex} from '@polkadot/util';
import {mnemonicGenerate} from '@polkadot/util-crypto';
import {KeypairType} from '@polkadot/util-crypto/types';

export class PolkadotJs {
  provider: string;

  constructor(wssProvider?: string) {
    this.provider = wssProvider ?? '';
  }

  async polkadotApi(): Promise<ApiPromise> {
    try {
      const provider = new WsProvider(this.provider);
      const api = await new ApiPromise({provider}).isReadyOrError;

      return api;
    } catch (e) {
      throw new Error('LostConnection');
    }
  }

  getKeyring(type?: string, addressFormat?: number): Keyring {
    return new Keyring({
      type: type as KeypairType | '' as KeypairType,
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
