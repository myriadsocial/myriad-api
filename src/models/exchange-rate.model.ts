import {Model, model, property} from '@loopback/repository';

@model()
export class ExchangeRate extends Model {
  @property({
    type: 'string',
    required: true,
  })
  id: string;

  @property({
    type: 'number',
    required: true,
  })
  price: number;

  constructor(data?: Partial<ExchangeRate>) {
    super(data);
  }
}
