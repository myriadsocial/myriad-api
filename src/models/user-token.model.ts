import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'userTokens'
    }
  }
})
export class UserToken extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId'
    }
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
  tokenId: string;


  constructor(data?: Partial<UserToken>) {
    super(data);
  }
}

export interface UserTokenRelations {
  // describe navigational properties here
}

export type UserTokenWithRelations = UserToken & UserTokenRelations;
