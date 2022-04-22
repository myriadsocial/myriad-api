import {Entity, model, property, belongsTo} from '@loopback/repository';
import {User, UserWithRelations} from './user.model';
import {Network} from './network.model';

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
    type: 'boolean',
    required: false,
  })
  primary: boolean;

  @property({
    type: 'string',
    required: false,
  })
  ecosystem: string;

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

  @belongsTo(() => Network, {}, {required: true})
  networkId: string;

  constructor(data?: Partial<Wallet>) {
    super(data);
  }
}

export interface WalletRelations {
  // describe navigational properties here
  user?: UserWithRelations;
}

export type WalletWithRelations = Wallet & WalletRelations;
