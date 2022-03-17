import {Entity, model, property, belongsTo} from '@loopback/repository';
import {NetworkType, WalletType} from '../enums';
import {User, UserWithRelations} from './user.model';

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
    jsonSchema: {
      enum: Object.values(WalletType),
    },
  })
  type: WalletType;

  @property({
    type: 'array',
    itemType: 'string',
    required: false,
  })
  networks: string[];

  @property({
    type: 'string',
    required: true,
  })
  network: NetworkType;

  @property({
    type: 'boolean',
    required: false,
  })
  primary: boolean;

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
  user?: UserWithRelations;
}

export type WalletWithRelations = Wallet & WalletRelations;
