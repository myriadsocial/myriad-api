import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'userCurrencies',
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

  @property({
    type: 'string',
    required: true,
  })
  userId: string;

  @property({
    type: 'string',
    required: true,
  })
  currencyId: string;

  constructor(data?: Partial<UserCurrency>) {
    super(data);
  }
}

export interface UserCurrencyRelations {
  // describe navigational properties here
}

export type UserCurrencyWithRelations = UserCurrency & UserCurrencyRelations;
