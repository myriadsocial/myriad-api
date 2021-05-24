import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'detailTransactions'
    }
  }

})
export class DetailTransaction extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId'
    }
  })
  id?: string;

  @property({
    type: 'number',
  })
  sentToMe: number;

  @property({
    type: 'number',
  })
  sentToThem: number;

  @property({
    type: 'string',
  })
  userId?: string;

  @property({
    type: 'string',
  })
  tokenId?: string;

  constructor(data?: Partial<DetailTransaction>) {
    super(data);
  }
}

export interface DetailTransactionRelations {
  // describe navigational properties here
}

export type DetailTransactionWithRelations = DetailTransaction & DetailTransactionRelations;
