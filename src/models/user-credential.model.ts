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
  id: string;

  @property({
    type: 'boolean',
    required: true,
  })
  is_verified: boolean;

  @property({
    type: 'string'
  })
  platform: string

  @belongsTo(() => People, {name: 'people'})
  people_id: string;

  @belongsTo(() => User, {name: 'user'})
  user_id: string

  constructor(data?: Partial<UserCredential>) {
    super(data);
  }
}

export interface UserCredentialRelations {
  // describe navigational properties here
}

export type UserCredentialWithRelations = UserCredential & UserCredentialRelations;
