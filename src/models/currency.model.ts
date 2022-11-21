import {belongsTo, Entity, model, property} from '@loopback/repository';
import {Network, NetworkWithRelations} from './network.model';

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
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
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
  symbol: string;

  @property({
    type: 'string',
    required: true,
  })
  image: string;

  @property({
    type: 'number',
    required: false,
  })
  decimal: number;

  @property({
    type: 'boolean',
    required: false,
  })
  native: boolean;

  // ContractId
  @property({
    type: 'string',
    required: false,
  })
  referenceId?: string;

  @property({
    type: 'boolean',
    required: false,
  })
  exchangeRate?: boolean;

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

  @property({
    type: 'number',
  })
  price?: number;

  @belongsTo(() => Network)
  networkId: string;

  constructor(data?: Partial<Currency>) {
    super(data);
  }
}

export interface CurrencyRelations {
  // describe navigational properties here
  network?: NetworkWithRelations;
}

export type CurrencyWithRelations = Currency & CurrencyRelations;
