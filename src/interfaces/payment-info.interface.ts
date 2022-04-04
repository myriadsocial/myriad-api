import {KeyringPair} from '@polkadot/keyring/types';

export interface PaymentInfo {
  amount: number;
  to: string;
  from: KeyringPair;
  currencyId: string;
  decimal: number;
  native?: boolean;
}
