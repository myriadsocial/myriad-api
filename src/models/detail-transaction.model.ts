import {Entity, model, property, belongsTo} from '@loopback/repository';
import {User} from './user.model';
import {Token} from './token.model';

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
  
  @belongsTo(() => User)
  userId: string;

  @belongsTo(() => Token)
  tokenId: string;

  constructor(data?: Partial<DetailTransaction>) {
    super(data);
  }
}

export interface DetailTransactionRelations {
  // describe navigational properties here
}

export type DetailTransactionWithRelations = DetailTransaction & DetailTransactionRelations;
