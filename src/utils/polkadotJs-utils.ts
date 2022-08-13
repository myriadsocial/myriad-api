import {AnyObject} from '@loopback/repository';
import {ApiPromise, Keyring, WsProvider} from '@polkadot/api';
import {KeyringPair} from '@polkadot/keyring/types';
import {numberToHex, u8aToHex, hexToU8a, isHex} from '@polkadot/util';
import {
  mnemonicGenerate,
  encodeAddress,
  decodeAddress,
} from '@polkadot/util-crypto';
import {KeypairType} from '@polkadot/util-crypto/types';
import {signatureVerify} from '@polkadot/util-crypto';
import {Credential} from '../models';

export class PolkadotJs {
  static signatureVerify(credential: Credential): boolean {
    const {nonce, signature, publicAddress} = credential;

    if (!signature.startsWith('0x')) return false;
    if (signature.length !== 130) return false;

    const {isValid} = signatureVerify(
      numberToHex(nonce),
      signature,
      publicAddress,
    );

    return isValid;
  }

  async polkadotApi(
    wssProvider: string,
    typesBundle?: AnyObject,
  ): Promise<ApiPromise> {
    try {
      const provider = new WsProvider(wssProvider, false);

      provider.connect() as Promise<void>;

      let api: ApiPromise;

      if (!typesBundle) {
        api = new ApiPromise({provider});
      } else {
        api = new ApiPromise({provider, typesBundle: typesBundle});
      }

      await api.isReadyOrError;

      return api;
    } catch (e) {
      throw new Error('LostConnection');
    }
  }

  async getSystemParameters(api: ApiPromise) {
    const chainName = (await api.rpc.system.chain()).toHuman();
    const chainType = (await api.rpc.system.chainType()).toHuman();
    const genesisHash = (await api.query.system.blockHash(0)).toHuman();
    const params = await api.rpc.system.properties();
    const ss58Format = params.ss58Format.value.toHuman();
    const decimals = params.tokenDecimals.value.toHuman() as string[];
    const symbols = params.tokenSymbol.value.toHuman() as string[];
    const symbolsDecimals = symbols.reduce(
      (acc, symbol, index) => ({
        ...acc,
        [symbol]: +decimals[index],
      }),
      {},
    );

    return {
      chainName: chainName,
      chainType: chainType,
      genesisHash: genesisHash,
      ss58Format: ss58Format,
      decimals: decimals as string[],
      symbols: symbols as string[],
      symbolsDecimals: symbolsDecimals as AnyObject,
    };
  }

  generateSeed(): string {
    return mnemonicGenerate();
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

  publicKeyToString(publicKey: Uint8Array): string {
    return u8aToHex(publicKey);
  }

  addressToPublicKey(address: string): string {
    return encodeAddress(address);
  }

  validatePolkadotAddress(address: string): boolean {
    const valid = false;
    try {
      const addressToU8a = isHex(address)
        ? hexToU8a(address)
        : decodeAddress(address);
      const validAddress = encodeAddress(addressToU8a);

      return Boolean(validAddress);
    } catch {
      // ignore
    }

    return valid;
  }
}
