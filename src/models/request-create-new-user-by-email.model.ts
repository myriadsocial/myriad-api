import {model, property} from '@loopback/repository';
import {RequestCreateNewUser} from './request-create-new-user.model';

@model()
export class RequestCreateNewUserByEmail extends RequestCreateNewUser {
  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      minLength: 5,
    },
  })
  email: string;

  constructor(data?: Partial<RequestCreateNewUserByEmail>) {
    super(data);
  }
}

export interface RequestCreateNewUserByEmailRelations {
  // describe navigational properties here
}

export type RequestCreateNewUserByEmailWithRelations =
  RequestCreateNewUserByEmail & RequestCreateNewUserByEmailRelations;
