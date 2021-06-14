import {belongsTo, Entity, model, property} from '@loopback/repository';
import {People} from './people.model';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'userCredentials'
    }
  }
})
export class UserCredential extends Entity {
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
    required: false,
  })
  access_token?: string;

  @property({
    type: 'string',
    required: false,
  })
  refresh_token?: string;

  @property({
    type: 'boolean',
    required: true,
  })
  isLogin: boolean;

  @belongsTo(() => People)
  peopleId: string;

  @belongsTo(() => User)
  userId: string

  constructor(data?: Partial<UserCredential>) {
    super(data);
  }
}

export interface UserCredentialRelations {
  // describe navigational properties here
}

export type UserCredentialWithRelations = UserCredential & UserCredentialRelations;
