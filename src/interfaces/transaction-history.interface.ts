export interface UserTransactionHistory {
  sent: TransactionDetail[];
  received: TransactionDetail[];
}

export interface PostTransactionHistory extends TransactionDetail {}

export interface TransactionDetail {
  _id: string;
  amount: number;
}
