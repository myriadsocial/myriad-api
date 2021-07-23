import {belongsTo, Entity, model, property} from '@loopback/repository';
import {User, UserWithRelations} from './user.model';
import {FriendStatusType} from '../enums';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'friends',
    },
  },
})
export class Friend extends Entity {
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
    required: false,
    jsonSchema: {
      enum: Object.values(FriendStatusType),
    },
    default: FriendStatusType.PENDING,
  })
  status: string;

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
  friend: UserWithRelations;
  requestor: UserWithRelations;
}

export type FriendWithRelations = Friend & FriendRelations;
