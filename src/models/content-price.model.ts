import {Entity, model, property, belongsTo} from '@loopback/repository';
import {Currency} from './currency.model';
import {UnlockableContent} from './unlockable-content.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'contentPrices',
    },
  },
})
export class ContentPrice extends Entity {
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
    type: 'number',
    required: true,
  })
  amount: number;

  @belongsTo(() => Currency)
  currencyId: string;

  @belongsTo(() => UnlockableContent)
  unlockableContentId: string;

  constructor(data?: Partial<ContentPrice>) {
    super(data);
  }
}

export interface ContentPriceRelations {
  // describe navigational properties here
  currency?: Currency;
}

export type ContentPriceWithRelations = ContentPrice & ContentPriceRelations;
