import {Model, model, property} from '@loopback/repository';
import {WalletType, NetworkType} from '../enums';

@model()
export class UserWallet extends Model {
  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      minLength: 2,
    },
  })
  name: string;

  @property({
    type: 'string',
    required: true,
    index: {
      unique: true,
    },
    jsonSchema: {
      maxLength: 16,
    },
  })
  username: string;

  @property({
    type: 'string',
    required: true,
  })
  address: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: Object.values(WalletType),
    },
  })
  type: WalletType;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: Object.values(NetworkType),
    },
  })
  network: NetworkType;

  constructor(data?: Partial<UserWallet>) {
    super(data);
  }
}

export interface UserWalletRelations {
  // describe navigational properties here
}

export type UserWalletWithRelations = UserWallet & UserWalletRelations;
