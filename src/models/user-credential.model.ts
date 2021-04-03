import {Entity, model, property, belongsTo} from '@loopback/repository';
import {User} from './user.model';
import {People} from './people.model';

@model({
  settings: {
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
    required: true,
  })
  access_token: string;

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
