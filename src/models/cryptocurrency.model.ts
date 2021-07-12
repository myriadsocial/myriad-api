import {Entity, hasMany, model, property} from '@loopback/repository';
import {TransactionHistory} from './transaction-history.model';
import {Transaction} from './transaction.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'cryptocurrencies'
    }
  }
})
export class Cryptocurrency extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: false,
    required: true
  })
  id: string;

  @property({
    type: 'string',
    required: true,
  })
  name: string;

  @property({
    type: 'string',
    required: true
  })
  image: string

  @property({
    type: 'number',
    required: true,
  })
  decimal: number;

  @property({
    type: 'number',
    required: true,
  })
  address_format: number;

  @property({
    type: 'string',
    required: true,
  })
  rpc_address: string;

  @property({
    type: 'boolean',
    required: true
  })
  is_native: boolean

  @hasMany(() => Transaction, {keyTo: 'cryptocurrency_id'})
  transactions: Transaction[];

  @hasMany(() => TransactionHistory, {keyTo: 'cryptocurrency_id'})
  transactionHistories: TransactionHistory[];

  constructor(data?: Partial<Cryptocurrency>) {
    super(data);
  }
}

export interface CryptocurrencyRelations {
  // describe navigational properties here
}

export type CryptocurrencyWithRelations = Cryptocurrency & CryptocurrencyRelations;
