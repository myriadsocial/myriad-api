import {belongsTo, Entity, model, property} from '@loopback/repository';
import {TransactionType} from '../enums/content-type.enum';
import {Currency} from './currency.model';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'transactions',
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
      enum: Object.values(TransactionType),
    },
  })
  type: TransactionType;

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

  @belongsTo(
    () => User,
    {name: 'fromUser'},
    {
      jsonSchema: {
        maxLength: 66,
        minLength: 66,
        pattern: '^0x',
      },
      required: true,
    },
  )
  from: string;

  @belongsTo(
    () => User,
    {name: 'toUser'},
    {
      jsonSchema: {
        maxLength: 66,
        minLength: 66,
        pattern: '^0x',
      },
      required: true,
    },
  )
  to: string;

  @belongsTo(() => Currency, {}, {required: true})
  currencyId: string;

  constructor(data?: Partial<Transaction>) {
    super(data);
    this.currencyId = this.currencyId.toUpperCase();
  }
}

export interface TransactionRelations {
  // describe navigational properties here
}

export type TransactionWithRelations = Transaction & TransactionRelations;
