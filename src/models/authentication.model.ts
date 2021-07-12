import {Entity, hasOne, model, property} from '@loopback/repository';
import {AuthCredential} from './auth-credential.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'authentications'
    }
  }
})
export class Authentication extends Entity {
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
    index: {
      unique: true
    }
  })
  email: string;

  @property({
    type: 'boolean',
  })
  email_verified?: boolean;

  @property({
    type: 'string',
  })
  verification_token?: string;

  @hasOne(() => AuthCredential, {keyTo: 'authentication_id'})
  credential: AuthCredential;

  [prop: string]: any;

  constructor(data?: Partial<Authentication>) {
    super(data);
  }
}

export interface AuthenticationRelations {
  // describe navigational properties here
}

export type AuthenticationWithRelations = Authentication & AuthenticationRelations;
