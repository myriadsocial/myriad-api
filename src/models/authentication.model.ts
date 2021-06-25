import {Entity, model, property} from '@loopback/repository';

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
  })
  email: string;

  @property({
    type: 'string',
    required: true,
  })
  password: string;


  constructor(data?: Partial<Authentication>) {
    super(data);
  }
}

export interface AuthenticationRelations {
  // describe navigational properties here
}

export type AuthenticationWithRelations = Authentication & AuthenticationRelations;
