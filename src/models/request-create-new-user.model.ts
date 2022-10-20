import {Model, model, property} from '@loopback/repository';

@model()
export class RequestCreateNewUser extends Model {
  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      maxLength: 16,
    },
  })
  username: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      minLength: 2,
    },
  })
  name: string;

  constructor(data?: Partial<RequestCreateNewUser>) {
    super(data);
  }
}

export interface RequestCreateNewUserRelations {
  // describe navigational properties here
}

export type RequestCreateNewUserWithRelations = RequestCreateNewUser &
  RequestCreateNewUserRelations;
