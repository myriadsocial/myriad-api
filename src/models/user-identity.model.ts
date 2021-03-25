import {Entity, model, property, belongsTo} from '@loopback/repository';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'userIdentities',
    },
  }
})
export class UserIdentity extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectID'
    },
  })
  id?: string;

  @property({
    type: 'string',
    required: true,
  })
  provider: string;

  @property({
    type: 'object',
    required: true,
  })
  profile: object;

  @property({
    type: 'object',
  })
  credentials?: object;

  @property({
    type: 'string',
    required: true,
  })
  authScheme: string;

  @property({
    type: 'date',
    required: true,
  })
  createdAt: string;

  @belongsTo(() => User)
  userId: string;

  constructor(data?: Partial<UserIdentity>) {
    super(data);
  }
}

export interface UserIdentityRelations {
  // describe navigational properties here
}

export type UserIdentityWithRelations = UserIdentity & UserIdentityRelations;
