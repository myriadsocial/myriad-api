import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'cryptocurrencies',
    },
  },
})
export class Cryptocurrency extends Entity {
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
  addressFormat: number;

  @property({
    type: 'string',
    required: true,
  })
  rpcAddress: string;

  @property({
    type: 'boolean',
    required: true,
  })
  isNative: boolean;

  constructor(data?: Partial<Cryptocurrency>) {
    super(data);
  }
}

export interface CryptocurrencyRelations {
  // describe navigational properties here
}

export type CryptocurrencyWithRelations = Cryptocurrency & CryptocurrencyRelations;
