import {Entity, model, property, belongsTo} from '@loopback/repository';
import {User} from './user.model';
import {Currency} from './currency.model';
import {Network} from './network.model';

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
}

export type UserCurrencyWithRelations = UserCurrency & UserCurrencyRelations;
