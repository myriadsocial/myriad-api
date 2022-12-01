import {
  AnyObject,
  Entity,
  model,
  property,
  belongsTo,
} from '@loopback/repository';
import {Currency} from './currency.model';
import {User, UserWithRelations} from './user.model';

type Price = Currency & {
  amount: string;
};

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
    type: 'array',
    itemType: 'object',
    required: true,
  })
  prices: Price[];

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
