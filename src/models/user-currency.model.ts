import {belongsTo, Entity, model, Model, property} from '@loopback/repository';
import {Currency, CurrencyWithRelations} from './currency.model';
import {Network} from './network.model';
import {User} from './user.model';

@model({
  settings: {
    mongodb: {
      collection: 'userCurrencies',
    },
    indexes: {
      userCurrencyIndex: {
        keys: {
          userId: 1,
          currencyId: 1,
          networkId: 1,
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
  })
  id?: string;

  @property({
    type: 'number',
    required: false,
  })
  priority: number;

  @belongsTo(() => User)
  userId: string;

  @belongsTo(() => Currency)
  currencyId: string;

  @belongsTo(() => Network)
  networkId: string;

  constructor(data?: Partial<UserCurrency>) {
    super(data);
  }
}

export interface UserCurrencyRelations {
  // describe navigational properties here
  currency?: CurrencyWithRelations;
}

export type UserCurrencyWithRelations = UserCurrency & UserCurrencyRelations;

export class Priority extends Model {
  @property({
    type: 'array',
    itemType: 'string',
    required: true,
  })
  currencyIds: string[];

  constructor(data?: Partial<Priority>) {
    super(data);
  }
}
