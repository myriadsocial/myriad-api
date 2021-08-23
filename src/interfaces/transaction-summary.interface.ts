export interface TransactionDetail {
  currencyId: string;
  amount: number;
}

export interface UserTransactionSummary {
  sent: TransactionDetail[];
  received: TransactionDetail[];
}

export type PostTransactionSummary = TransactionDetail;

export type CommentTransactionSummary = TransactionDetail;
