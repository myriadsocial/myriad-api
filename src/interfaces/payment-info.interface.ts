import {KeyringPair} from '@polkadot/keyring/types';

export interface PaymentInfo {
  total: number;
  to: string;
  from: KeyringPair;
  cryptoId: string;
  decimal: number;
  isNative?: boolean;
  txFee: number;
  tipId?: string;
  fromString: string;
  nonce: number;
  txHash: string;
}
