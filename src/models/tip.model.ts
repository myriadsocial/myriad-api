import {Entity, model, property, belongsTo} from '@loopback/repository';
import {Cryptocurrency} from './cryptocurrency.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'tips'
    },
    hiddenProperties: ['total_tips']
  }
})
export class Tip extends Entity {
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
    required: true,
  })
  total_tips: number;

  @property({
    type: 'string',
  })
  people_id?: string;
  
  @property({
    type: 'object',
    required: false
  })
  cryptocurrency: Cryptocurrency

  @belongsTo(() => Cryptocurrency, {name: 'cryptocurrency'})
  cryptocurrency_id: string;

  constructor(data?: Partial<Tip>) {
    super(data);
  }
}

export interface TipRelations {
  // describe navigational properties here
  cryptocurrency: Cryptocurrency
}

export type TipWithRelations = Tip & TipRelations;
