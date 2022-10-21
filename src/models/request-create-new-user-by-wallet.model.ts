import {model, property} from '@loopback/repository';
import {RequestCreateNewUser} from './request-create-new-user.model';

@model()
export class RequestCreateNewUserByWallet extends RequestCreateNewUser {
  @property({
    type: 'string',
    required: true,
  })
  address: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      minLength: 2,
    },
  })
  network: string;

  constructor(data?: Partial<RequestCreateNewUserByWallet>) {
    super(data);
  }
}

export interface RequestCreateNewUserByWalletRelations {
  // describe navigational properties here
}

export type RequestCreateNewUserByWalletWithRelations =
  RequestCreateNewUserByWallet & RequestCreateNewUserByWalletRelations;
