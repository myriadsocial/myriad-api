// TODO: Rename UserToken to UserCrypto
import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'userTokens',
    },
  },
})
export class UserCrypto extends Entity {
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

  constructor(data?: Partial<UserCrypto>) {
    super(data);
  }
}

export interface UserCryptoRelations {
  // describe navigational properties here
}

export type UserCryptoWithRelations = UserCrypto & UserCryptoRelations;
