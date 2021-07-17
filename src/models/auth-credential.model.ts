import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'authCredentials',
    },
  },
})
export class AuthCredential extends Entity {
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
  password: string;

  @property({
    type: 'string',
    required: true,
  })
  authenticationId: string;

  constructor(data?: Partial<AuthCredential>) {
    super(data);
  }
}

export interface AuthCredentialRelations {
  // describe navigational properties here
}

export type AuthCredentialWithRelations = AuthCredential &
  AuthCredentialRelations;
