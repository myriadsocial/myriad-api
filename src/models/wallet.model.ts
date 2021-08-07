import {Model, model, property} from '@loopback/repository';

@model()
export class Wallet extends Model {
  @property({
    type: 'string',
    required: true,
  })
  walletAddress: string;

  constructor(data?: Partial<Wallet>) {
    super(data);
  }
}
