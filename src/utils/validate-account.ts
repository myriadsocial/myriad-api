import {Credential} from '../models';
import {numberToHex, hexToU8a} from '@polkadot/util';
import {signatureVerify} from '@polkadot/util-crypto';
import nacl from 'tweetnacl';

export function validateAccount(credential: Credential): boolean {
  const {nonce, signature, publicAddress, walletType} = credential;

  switch (walletType) {
    case 'polkadot{.js}': {
      if (!signature.startsWith('0x')) return false;
      if (signature.length !== 130) return false;
      const {isValid} = signatureVerify(
        numberToHex(nonce),
        signature,
        publicAddress,
      );
      return isValid;
    }

    case 'near': {
      const publicKey = publicAddress.replace('0x', '');
      return nacl.sign.detached.verify(
        Buffer.from(numberToHex(nonce)),
        Buffer.from(hexToU8a(signature)),
        Buffer.from(publicKey, 'hex'),
      );
    }

    default:
      return false;
  }
}
