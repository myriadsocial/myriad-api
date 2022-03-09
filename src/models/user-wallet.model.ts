import {Model, model, property} from '@loopback/repository';
import {BlockchainPlatform} from '../enums';

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
  walletAddress: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: Object.values(BlockchainPlatform),
    },
  })
  blockchainPlatform: BlockchainPlatform;

  constructor(data?: Partial<UserWallet>) {
    super(data);
  }
}

export interface UserWalletRelations {
  // describe navigational properties here
}

export type UserWalletWithRelations = UserWallet & UserWalletRelations;
