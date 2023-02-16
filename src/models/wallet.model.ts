import {Entity, model, property, belongsTo} from '@loopback/repository';
import {User, UserWithRelations} from './user.model';
import {NetworkWithRelations} from './network.model';

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
    required: false,
  })
  blockchainPlatform: string;

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
  network?: NetworkWithRelations;
}

export type WalletWithRelations = Wallet & WalletRelations;
