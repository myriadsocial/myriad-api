import {AnyObject, Model, model, property} from '@loopback/repository';
import {NetworkType, WalletType} from '../enums';

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
    jsonSchema: {
      enum: Object.values(WalletType),
    },
  })
  walletType: WalletType;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: Object.values(NetworkType),
    },
  })
  networkType: NetworkType;

  @property({
    type: 'object',
    required: false,
  })
  data: AnyObject;

  constructor(data?: Partial<Credential>) {
    super(data);
  }
}

export interface CredentialRelations {
  // describe navigational properties here
}

export type CredentialWithRelations = Credential & CredentialRelations;
