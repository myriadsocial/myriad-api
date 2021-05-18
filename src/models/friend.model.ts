import {Entity, model, property, belongsTo} from '@loopback/repository';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'friends'
    }
  }
})
export class Friend extends Entity {
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
    required: false,
    default: 'pending'
  })
  status: string

  @property({
    type: 'date',
    required: false
  })
  createdAt?: string

  @property({
    type: 'date',
    required: false,
  })
  updatedAt?: string

  @belongsTo(() => User)
  friendId: string;

  @belongsTo(() => User)
  requestorId: string;

  constructor(data?: Partial<Friend>) {
    super(data);
  }
}

export interface FriendRelations {
  // describe navigational properties here
}

export type FriendWithRelations = Friend & FriendRelations;
