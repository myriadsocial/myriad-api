import {belongsTo, Entity, model, property} from '@loopback/repository';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'topics',
    },
  }
})
export class Topic extends Entity {
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

  constructor(data?: Partial<Topic>) {
    super(data);
  }
}

export interface TopicRelations {
  // describe navigational properties here
}

export type TopicWithRelations = Topic & TopicRelations;
