import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'tips'
    },
    hiddenProperties: ['totalTips']
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
    type: 'string',
    required: true,
  })
  tokenId: string;

  @property({
    type: 'number',
    required: true,
  })
  totalTips: number;

  @property({
    type: 'string',
  })
  peopleId?: string;

  constructor(data?: Partial<Tip>) {
    super(data);
  }
}

export interface TipRelations {
  // describe navigational properties here
}

export type TipWithRelations = Tip & TipRelations;
