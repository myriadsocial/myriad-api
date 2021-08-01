import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'userCryptocurrencies',
    },
  },
})
export class UserCryptocurrency extends Entity {
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
  userId: string;

  @property({
    type: 'string',
    required: true,
  })
  cryptocurrencyId: string;

  constructor(data?: Partial<UserCryptocurrency>) {
    super(data);
  }
}

export interface UserCryptocurrencyRelations {
  // describe navigational properties here
}

export type UserCryptocurrencyWithRelations = UserCryptocurrency & UserCryptocurrencyRelations;
