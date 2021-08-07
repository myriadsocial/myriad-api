import {KeyringPair} from '@polkadot/keyring/types';
import {DefaultCurrencyType} from '../enums';

export interface PaymentInfo {
  amount: number;
  to: string;
  from: KeyringPair;
  fromString: string;
  currencyId: DefaultCurrencyType;
  decimal: number;
  native?: boolean;
  txFee: number;
  nonce: number;
}
