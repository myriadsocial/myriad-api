import {Model, model, property} from '@loopback/repository';

@model()
export class ClaimReference extends Model {
  @property({
    type: 'string',
  })
  txFee: string;

  @property({
    type: 'string',
  })
  tippingContractId?: string;
}
