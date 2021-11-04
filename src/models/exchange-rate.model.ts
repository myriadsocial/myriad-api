import {Entity, model, property} from '@loopback/repository';

@model()
export class ExchangeRate extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: false,
    required: true,
  })
  id: string;

  @property({
    type: 'number',
    required: true,
  })
  price: number;

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

  constructor(data?: Partial<ExchangeRate>) {
    super(data);
  }
}

export interface ExchangeRateRelations {
  // describe navigational properties here
}

export type ExchangeRateWithRelations = ExchangeRate & ExchangeRateRelations;
