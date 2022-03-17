import {belongsTo, Entity, model, property} from '@loopback/repository';
import {ReferenceType} from '../enums/reference-type.enum';
import {Currency} from './currency.model';
import {Wallet} from './wallet.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'transactions',
    },
    indexes: {
      fromIndex: {
        keys: {
          to: 1,
        },
      },
      toIndex: {
        keys: {
          from: 1,
        },
      },
      currencyIdIndex: {
        keys: {
          currencyId: 1,
        },
      },
    },
  },
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
  hash: string;

  @property({
    type: 'number',
    required: true,
  })
  amount: number;

  @property({
    type: 'string',
    required: false,
    jsonSchema: {
      enum: Object.values(ReferenceType),
    },
  })
  type: ReferenceType;

  @property({
    type: 'string',
    required: false,
  })
  referenceId?: string;

  @property({
    type: 'date',
    required: false,
    default: () => new Date(),
  })
  createdAt?: string;

  @property({
    type: 'date',
    required: false,
    default: () => new Date(),
  })
  updatedAt?: string;

  @property({
    type: 'date',
    required: false,
  })
  deletedAt?: string;

  @belongsTo(() => Wallet, {name: 'fromWallet'}, {required: true})
  from: string;

  @belongsTo(() => Wallet, {name: 'toWallet'}, {required: true})
  to: string;

  @belongsTo(() => Currency, {}, {required: true})
  currencyId: string;

  constructor(data?: Partial<Transaction>) {
    super(data);
  }
}

export interface TransactionRelations {
  // describe navigational properties here
}

export type TransactionWithRelations = Transaction & TransactionRelations;
