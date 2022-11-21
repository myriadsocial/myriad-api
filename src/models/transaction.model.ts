import {belongsTo, Entity, Model, model, property} from '@loopback/repository';
import {ReferenceType} from '../enums/reference-type.enum';
import {Currency} from './currency.model';
import {User, UserWithRelations} from './user.model';

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

  @belongsTo(() => User, {name: 'fromUser'})
  from: string;

  @belongsTo(() => User, {name: 'toUser'})
  to: string;

  @belongsTo(() => Currency, {}, {required: true})
  currencyId: string;

  constructor(data?: Partial<Transaction>) {
    super(data);
  }
}

export interface TransactionRelations {
  // describe navigational properties here
  fromUser?: UserWithRelations;
}

export type TransactionWithRelations = Transaction & TransactionRelations;

export class UpdateTransactionDto extends Model {
  @property({
    type: 'array',
    itemType: 'string',
  })
  currencyIds: string[];

  constructor(data?: Partial<UpdateTransactionDto>) {
    super(data);
  }
}

export class TxDetail extends Model {
  @property({
    type: 'string',
    required: true,
  })
  txFee: string;

  @property({
    type: 'string',
  })
  tippingContractId?: string;

  constructor(data?: Partial<TxDetail>) {
    super(data);
  }
}
