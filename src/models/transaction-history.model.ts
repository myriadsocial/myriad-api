import {Entity, model, property, belongsTo} from '@loopback/repository';
import {User} from './user.model';
import {Cryptocurrency} from './cryptocurrency.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'transactionHistories',
    },
  },
})
export class TransactionHistory extends Entity {
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
    type: 'number',
  })
  sentToMe: number;

  @property({
    type: 'number',
  })
  sentToThem: number;

  @property({
    type: 'date',
    required: false,
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

  @belongsTo(() => User, {name: 'user'})
  userId: string;

  @belongsTo(() => Cryptocurrency, {name: 'cryptocurrency'})
  cryptocurrencyId: string;

  constructor(data?: Partial<TransactionHistory>) {
    super(data);
  }
}

export interface TransactionHistoryRelations {
  // describe navigational properties here
}

export type TransactionHistoryWithRelations = TransactionHistory & TransactionHistoryRelations;
