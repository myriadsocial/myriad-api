import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'userRefreshTokens',
    },
  },
})
export class UserRefreshToken extends Entity {
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
  refreshToken: string;

  @property({
    type: 'string',
    required: true,
  })
  userId: string;

  constructor(data?: Partial<UserRefreshToken>) {
    super(data);
  }
}

export interface UserRefreshTokenRelations {
  // describe navigational properties here
}

export type UserRefereshTokenWithRelations = UserRefreshToken &
  UserRefreshTokenRelations;
