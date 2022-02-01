import {belongsTo, Entity, model, property} from '@loopback/repository';
import {Currency} from './currency.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'userCurrencies',
    },
    indexes: {
      currencyIdIndex: {
        keys: {
          currencyId: 1,
        },
      },
      userIdIndex: {
        keys: {
          userId: 1,
        },
      },
      uniqueUserCurrencyIndex: {
        keys: {
          userId: 1,
          currencyId: 1,
        },
        options: {
          unique: true,
        },
      },
    },
  },
})
export class UserCurrency extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
    indexes: {
      userCurrencyIndex: {
        keys: {
          userId: 1,
        },
      },
    },
  })
  id?: string;

  @property({
    type: 'number',
    required: false,
    default: 1,
  })
  priority: number;

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

  @property({
    type: 'string',
    required: true,
  })
  userId: string;

  @belongsTo(() => Currency, {}, {required: true})
  currencyId: string;

  constructor(data?: Partial<UserCurrency>) {
    super(data);
  }
}

export interface UserCurrencyRelations {
  // describe navigational properties here
  currency: Currency;
}

export type UserCurrencyWithRelations = UserCurrency & UserCurrencyRelations;
