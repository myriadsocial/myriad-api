import {Model, model, property} from '@loopback/repository';
import {WalletType} from '../enums';
import {BlockchainPlatform} from '../enums/blockchain-platform-type.enum';

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
  username?: string;

  @property({
    type: 'string',
    required: true,
  })
  walletName: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      maxLength: 66,
      minLength: 66,
      pattern: '^0x',
    },
  })
  walletAddress: string;

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
      enum: Object.values(BlockchainPlatform),
    },
  })
  walletPlatform: BlockchainPlatform;

  constructor(data?: Partial<UserWallet>) {
    super(data);
  }
}

export interface UserWalletRelations {
  // describe navigational properties here
}

export type UserWalletWithRelations = UserWallet & UserWalletRelations;
