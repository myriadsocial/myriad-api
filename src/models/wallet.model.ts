import {Entity, model, property, belongsTo} from '@loopback/repository';
import {BlockchainPlatform, WalletType} from '../enums';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'wallets',
    },
    indexes: {
      userIdIndex: {
        keys: {
          userId: 1,
        },
      },
    },
  },
})
export class Wallet extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: false,
    required: true,
  })
  id: string;

  @property({
    type: 'string',
    required: true,
  })
  name: string;

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
      enum: Object.values(BlockchainPlatform),
    },
  })
  platform: BlockchainPlatform;

  @property({
    type: 'boolean',
    required: false,
    default: false,
  })
  primary: boolean;

  @property({
    type: 'boolean',
    required: false,
    default: false,
  })
  hide: boolean;

  @property({
    type: 'date',
    required: false,
    default: () => new Date(),
  })
  createdAt?: string;

  @property({
    type: 'date',
    required: false,
    default: () => new Date(),
  })
  updatedAt?: string;

  @property({
    type: 'date',
    required: false,
  })
  deletedAt?: string;

  @belongsTo(() => User)
  userId: string;

  constructor(data?: Partial<Wallet>) {
    super(data);
  }
}

export interface WalletRelations {
  // describe navigational properties here
}

export type WalletWithRelations = Wallet & WalletRelations;
