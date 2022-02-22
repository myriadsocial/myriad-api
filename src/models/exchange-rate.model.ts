import {Entity, model, property} from '@loopback/repository';

@model()
export class ExchangeRate extends Entity {
  @property({
    type: 'number',
    required: true,
  })
  price: number;

  constructor(data?: Partial<ExchangeRate>) {
    super(data);
  }
}
