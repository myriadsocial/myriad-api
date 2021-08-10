import {belongsTo, Entity, model, property} from '@loopback/repository';
import {Authentication} from '.';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'refreshTokens',
    },
  },
})
export class AuthRefreshToken extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id?: string;

  @belongsTo(() => Authentication)
  authenticationId: string;

  @property({
    type: 'string',
    required: true,
  })
  refreshToken: string;

  constructor(data?: Partial<AuthRefreshToken>) {
    super(data);
  }
}

export interface AuthRefreshTokenRelations {
  // describe navigational properties here
}

export type AuthRefereshTokenWithRelations = AuthRefreshToken & AuthRefreshTokenRelations;
