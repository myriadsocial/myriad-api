import {Entity, model, property, belongsTo} from '@loopback/repository';
import {Cryptocurrency} from './cryptocurrency.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'personTips',
    },
    hiddenProperties: ['total'],
  },
})
export class PersonTip extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id?: string;
  @property({
    type: 'number',
    required: true,
  })
  total: number;

  @property({
    type: 'string',
  })
  peopleId?: string;

  @property({
    type: 'object',
    required: false,
  })
  cryptocurrency: Cryptocurrency;

  @belongsTo(() => Cryptocurrency)
  cryptocurrencyId: string;

  constructor(data?: Partial<PersonTip>) {
    super(data);
  }
}

export interface PersonTipRelations {
  // describe navigational properties here
  // cryptocurrency: Cryptocurrency;
}

export type PersonTipWithRelations = PersonTip & PersonTipRelations;
