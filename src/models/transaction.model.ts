import {belongsTo, Entity, model, property} from '@loopback/repository';
import {User} from './user.model';
import {Token, TokenWithRelations} from './token.model';

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
  trxHash: string;

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
  hasSendToUser: boolean

  @property({
    type: 'date',
    required: false,
    default: new Date
  })
  createdAt?: string;

  @property({
    type: 'date',
    required: false,
  })
  updatedAt?: string;

  @property({
    type: 'date',
    required: false,
  })
  deletedAt?: string;

  @belongsTo(() => Token)
  tokenId: string;

  constructor(data?: Partial<Transaction>) {
    super(data);
  }
}

export interface TransactionRelations {
  // describe navigational properties here
  token: TokenWithRelations
}

export type TransactionWithRelations = Transaction & TransactionRelations;
