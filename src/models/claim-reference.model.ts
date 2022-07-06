import {Model, model, property} from '@loopback/repository';

@model()
export class ClaimReference extends Model {
  @property({
    type: 'array',
    itemType: 'string',
  })
  referenceIds: string[];

  @property({
    type: 'string',
  })
  txFee: string;

  @property({
    type: 'string',
  })
  tippingContractId?: string;
}
