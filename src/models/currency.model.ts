import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'currencies',
    },
  },
})
export class Currency extends Entity {
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
  })
  image: string;

  @property({
    type: 'number',
    required: true,
  })
  decimal: number;

  @property({
    type: 'number',
    required: true,
  })
  addressType: number;

  @property({
    type: 'string',
    required: true,
  })
  rpcURL: string;

  @property({
    type: 'boolean',
    required: true,
  })
  native: boolean;

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

  constructor(data?: Partial<Currency>) {
    super(data);
    this.id = this.currencyToUpperCase();
  }

  currencyToUpperCase() {
    if (this.id) return this.id.toUpperCase();
    return '';
  }
}

export interface CurrencyRelations {
  // describe navigational properties here
}

export type CurrencyWithRelations = Currency & CurrencyRelations;
