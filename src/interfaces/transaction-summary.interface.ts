export interface TransactionDetail {
  currencyId: string;
  amount: number;
}

export interface UserTransactionSummary {
  sent: TransactionDetail[];
  received: TransactionDetail[];
}

export interface Transaction {
  hash: string;
}

export type PostTransactionSummary = TransactionDetail;

export type CommentTransactionSummary = TransactionDetail;
