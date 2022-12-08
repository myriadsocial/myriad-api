import {
  AnyObject,
  Entity,
  model,
  property,
  belongsTo,
  hasMany,
} from '@loopback/repository';
import {User, UserWithRelations} from './user.model';
import {ContentPrice} from './content-price.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'unlockableContents',
    },
    indexes: {
      createdByIndex: {
        keys: {
          createdBy: 1,
        },
      },
    },
    hiddenProperties: ['paidUserIds'],
  },
})
export class UnlockableContent extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id: string;

  @property({
    type: 'object',
    required: false,
    default: {},
  })
  content?: AnyObject;

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

  @hasMany(() => ContentPrice)
  prices: ContentPrice[];

  @belongsTo(() => User, {name: 'user'})
  createdBy: string;

  constructor(data?: Partial<UnlockableContent>) {
    super(data);
  }
}

export interface UnlockableContentRelations {
  // describe navigational properties here
  user?: UserWithRelations;
}

export type UnlockableContentWithRelations = UnlockableContent &
  UnlockableContentRelations;

export interface Price {
  currencyId: string;
  amount: number;
}

export class UnlockableContentWithPrice extends UnlockableContent {
  @property({
    type: 'array',
    itemType: 'object',
    required: false,
  })
  contentPrices: Price[];

  constructor(data?: Partial<UnlockableContentWithPrice>) {
    super(data);
  }
}
