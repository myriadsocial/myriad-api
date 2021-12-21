import {Model, model, property} from '@loopback/repository';

@model()
export class WalletAddress extends Model {
  @property({
    type: 'string',
    required: true,
  })
  walletAddress: string;

  constructor(data?: Partial<WalletAddress>) {
    super(data);
  }
}
