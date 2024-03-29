import {hexToU8a, isHex, numberToHex} from '@polkadot/util';
import * as bs58 from 'bs58';
import * as nearAPI from 'near-api-js';
import nacl from 'tweetnacl';
import {Credential} from '../models';

/* eslint-disable  @typescript-eslint/naming-convention */
export class Near {
  static async verifyAccessKey(
    credential: Credential,
    rpcURL: string,
    accountId: string,
  ): Promise<boolean> {
    const {publicAddress} = credential;

    try {
      const pk = 'ed25519:' + bs58.encode(Buffer.from(hexToU8a(publicAddress)));
      const provider = new nearAPI.providers.JsonRpcProvider({url: rpcURL});
      const address = isHex(accountId) ? accountId.substring(2) : accountId;
      const result = await provider.query({
        request_type: 'view_access_key',
        account_id: address,
        public_key: pk,
        finality: 'optimistic',
      });
      return Boolean(result);
    } catch (e) {
      return false;
    }
  }

  static signatureVerify(credential: Credential): boolean {
    const {nonce, signature, publicAddress} = credential;
    const publicKey = publicAddress.replace('0x', '');

    return nacl.sign.detached.verify(
      Buffer.from(numberToHex(nonce)),
      Buffer.from(hexToU8a(signature)),
      Buffer.from(publicKey, 'hex'),
    );
  }
}
