export interface PaymentInfo {
  total: number;
  to: string;
  from: any;
  cryptoId: string;
  decimal: number;
  isNative?: boolean;
  txFee: number;
  tipId?: string;
  fromString: string;
  nonce: number;
  txHash: string;
}
