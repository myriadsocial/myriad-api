import {belongsTo, Entity, model, property} from '@loopback/repository';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'userCredentials',
    },
  }
})
export class UserCredential extends Entity {
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
    hidden: true,
  })
  password: string;

  @belongsTo(() => User)
  userId: string;

  constructor(data?: Partial<UserCredential>) {
    super(data);
  }
}

export interface UserCredentialRelations {
  // describe navigational properties here
}

export type UserCredentialWithRelations = UserCredential & UserCredentialRelations;
