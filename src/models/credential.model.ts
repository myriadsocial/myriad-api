import {Model, model, property} from '@loopback/repository';

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
    jsonSchema: {
      maxLength: 66,
      minLength: 66,
      pattern: '^0x',
    },
  })
  publicAddress: string;

  @property({
    type: 'string',
    required: true,
  })
  signature: string;

  constructor(data?: Partial<Credential>) {
    super(data);
  }
}

export interface CredentialRelations {
  // describe navigational properties here
}

export type CredentialWithRelations = Credential & CredentialRelations;
