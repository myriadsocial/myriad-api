import {belongsTo, Entity, model, property} from '@loopback/repository';
import {Authentication} from '.';

@model({
  settings: {
      strictObjectIDCoercion: true,
      mongodb: {
        collection: 'refresh-tokens'
      }
  }
})
export class RefreshToken extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
        dataType: 'ObjectId'
    }
  })
  id?: string;

  @belongsTo(() => Authentication)
  authenticationId: string;

  @property({
    type: 'string',
    required: true,
  })
  refreshToken: string;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<RefreshToken>) {
    super(data);
  }
}

export interface RefreshTokenRelations {
  // describe navigational properties here
}

export type RefereshTokenWithRelations = RefreshToken & RefreshTokenRelations;