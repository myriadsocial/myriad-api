import {AnyObject, Model, model, property} from '@loopback/repository';

@model()
export class Credential extends Model {
  @property({
    type: 'number',
    required: true,
  })
  nonce: number;

  @property({
    type: 'string',
    required: true,
  })
  publicAddress: string;

  @property({
    type: 'string',
    required: true,
  })
  signature: string;

  @property({
    type: 'string',
    required: true,
  })
  walletType: string;

  @property({
    type: 'string',
    required: true,
  })
  networkType: string;

  @property({
    type: 'object',
    required: false,
  })
  data: AnyObject;

  @property({
    type: 'string',
    required: false,
  })
  role = 'user';

  constructor(data?: Partial<Credential>) {
    super(data);
  }
}

export interface CredentialRelations {
  // describe navigational properties here
}

export type CredentialWithRelations = Credential & CredentialRelations;
