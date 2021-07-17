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
export class RefreshToken extends Entity {
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

  constructor(data?: Partial<RefreshToken>) {
    super(data);
  }
}

export interface RefreshTokenRelations {
  // describe navigational properties here
}

export type RefereshTokenWithRelations = RefreshToken & RefreshTokenRelations;
