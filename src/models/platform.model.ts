import {belongsTo, Entity, model, property} from '@loopback/repository';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'platforms',
    },
  }
})
export class Platform extends Entity {
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
    index: {
      unique: true
    },
  })
  name: string;

  @property({
    type: 'date',
    required: false,
  })
  createdAt?: string;

  @property({
    type: 'date',
    required: false,
  })
  updatedAt?: string;

  @property({
    type: 'date',
    required: false,
  })
  deletedAt?: string;

  @belongsTo(() => User, {}, {
    mongodb: {
      dataType: 'ObjectId'
    }
  })
  userId: string;

  constructor(data?: Partial<Platform>) {
    super(data);
  }
}

export interface PlatformRelations {
  // describe navigational properties here
}

export type PlatformWithRelations = Platform & PlatformRelations;
