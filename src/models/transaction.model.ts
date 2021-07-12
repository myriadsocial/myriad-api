import {belongsTo, Entity, model, property} from '@loopback/repository';
import {Cryptocurrency, CryptocurrencyWithRelations} from './cryptocurrency.model';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'transactions',
    }
  }
})
export class Transaction extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id?: string;

  @property({
    type: 'string',
    required: true,
  })
  trx_hash: string;

  @belongsTo(() => User, {name: 'fromUser'})
  from: string;

  @belongsTo(() => User, {name: 'toUser'})
  to: string;

  @property({
    type: 'number',
    required: true,
  })
  value: number;

  @property({
    type: 'string',
    required: true,
  })
  state: string;

  @property({
    type: 'boolean',
    required: false
  })
  has_sent_to_user: boolean

  @property({
    type: 'date',
    required: false
  })
  created_at?: string;

  @property({
    type: 'date',
    required: false,
  })
  updated_at?: string;

  @property({
    type: 'date',
    required: false,
  })
  deleted_at?: string;

  @property({
    type: 'string'
  })
  post_id?: string

  @belongsTo(() => Cryptocurrency, {name: 'cryptocurrency'})
  cryptocurrency_id: string;

  constructor(data?: Partial<Transaction>) {
    super(data);
  }
}

export interface TransactionRelations {
  // describe navigational properties here
  cryptocurrency: CryptocurrencyWithRelations
}

export type TransactionWithRelations = Transaction & TransactionRelations;
