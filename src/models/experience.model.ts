import {belongsTo, Entity, model, property} from '@loopback/repository';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'experiences',
    },
  }
})
export class Experience extends Entity {
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
    type: 'string',
    required: true,
  })
  name: string;

  @property({
    type: 'array',
    itemType: 'string',
    required: false,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  corpus?: String[];

  @property({
    type: 'array',
    itemType: 'string',
    required: false,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  following?: String[];

  @belongsTo(() => User, {}, {
    mongodb: {
      dataType: 'ObjectId'
    }
  })
  userId: string;

  constructor(data?: Partial<Experience>) {
    super(data);
  }
}

export interface ExperienceRelations {
  // describe navigational properties here
}

export type ExperienceWithRelations = Experience & ExperienceRelations;
