import {Entity, model, property, belongsTo} from '@loopback/repository';
import {User} from './user.model';
import {Cryptocurrency} from './cryptocurrency.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'transactionHistories'
    }
  }

})
export class TransactionHistory extends Entity {
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
  sent_to_me: number;

  @property({
    type: 'number',
  })
  sent_to_them: number;
  
  @belongsTo(() => User, {name: 'user'})
  user_id: string;

  @belongsTo(() => Cryptocurrency, {name: 'cryptocurrency'})
  cryptocurrency_id: string;

  constructor(data?: Partial<TransactionHistory>) {
    super(data);
  }
}

export interface TransactionHistoryRelations {
  // describe navigational properties here
}

export type TransactionHistoryWithRelations = TransactionHistory & TransactionHistoryRelations;
