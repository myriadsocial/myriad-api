import {AnyObject, Entity, model, property} from '@loopback/repository';
import {Currency} from './currency.model';

type Price = Currency & {
  amount: string;
};

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'lockableContents',
    },
    hiddenProperties: ['paidUserIds'],
  },
})
export class LockableContent extends Entity {
  @property({
    type: 'string',
    id: true,
    required: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id?: string;

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
    type: 'array',
    itemType: 'string',
    default: [],
  })
  paidUserIds?: string[];

  @property({
    type: 'string',
    required: true,
  })
  referenceId: string;

  constructor(data?: Partial<LockableContent>) {
    super(data);
  }
}

export interface LockableContentRelations {
  // describe navigational properties here
}

export type LockableContentWithRelations = LockableContent &
  LockableContentRelations;
