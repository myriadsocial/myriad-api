export interface UserTransactionHistory {
  sent: TransactionDetail[];
  received: TransactionDetail[];
}

export interface PostTransactionHistory extends TransactionDetail {}

export interface TransactionDetail {
  currencyId: string;
  amount: number;
}
