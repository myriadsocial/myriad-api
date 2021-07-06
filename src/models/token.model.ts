import {Entity, hasMany, model, property} from '@loopback/repository';
import {DetailTransaction} from './detail-transaction.model';
import {Transaction} from './transaction.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'tokens'
    }
  }
})
export class Token extends Entity {
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
  token_name: string;

  @property({
    type: 'string',
    required: true
  })
  token_image: string

  @property({
    type: 'number',
    required: true,
  })
  token_decimal: number;

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

  @hasMany(() => Transaction)
  transactions: Transaction[];

  @hasMany(() => DetailTransaction)
  detailTransactions: DetailTransaction[];

  constructor(data?: Partial<Token>) {
    super(data);
  }
}

export interface TokenRelations {
  // describe navigational properties here
}

export type TokenWithRelations = Token & TokenRelations;
