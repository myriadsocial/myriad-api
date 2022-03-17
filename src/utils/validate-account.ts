import {WalletType} from '../enums';
import {Credential} from '../models';
import {numberToHex, hexToU8a} from '@polkadot/util';
import {signatureVerify} from '@polkadot/util-crypto';
import nacl from 'tweetnacl';

export function validateAccount(credential: Credential): boolean {
  const {nonce, signature, publicAddress, walletType} = credential;
  const publicKey = publicAddress.replace('0x', '');

  switch (walletType) {
    case WalletType.NEAR: {
      return nacl.sign.detached.verify(
        Buffer.from(numberToHex(nonce)),
        Buffer.from(hexToU8a(signature)),
        Buffer.from(publicKey, 'hex'),
      );
    }

    case WalletType.POLKADOT: {
      const {isValid} = signatureVerify(
        numberToHex(nonce),
        signature,
        publicAddress,
      );
      return isValid;
    }

    case WalletType.ETH: {
      return false;
    }

    default:
      return false;
  }
}
