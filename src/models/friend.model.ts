import {belongsTo, Entity, model, property} from '@loopback/repository';
import {FriendStatusType} from '../enums';
import {User, UserWithRelations} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'friends',
    },
    indexes: {
      requesteeIdIndex: {
        keys: {
          requesteeId: 1,
        },
      },
      requestorIdIndex: {
        keys: {
          requestorId: 1,
        },
      },
      uniqueFriendIndex: {
        keys: {
          requestorId: 1,
          requesteeId: 1,
        },
        options: {
          unique: true,
        },
      },
      friendStatusIndex: {
        keys: {
          requestorId: 1,
          requesteeId: 1,
          status: 1,
        },
      },
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
    required: true,
    jsonSchema: {
      enum: Object.values(FriendStatusType),
    },
  })
  status: FriendStatusType;

  @property({
    type: 'number',
    required: false,
  })
  totalMutual?: number;

  @property({
    type: 'date',
    required: false,
    default: () => new Date(),
  })
  createdAt?: string;

  @property({
    type: 'date',
    required: false,
    default: () => new Date(),
  })
  updatedAt?: string;

  @property({
    type: 'date',
    required: false,
  })
  deletedAt?: string;

  @belongsTo(() => User, {name: 'requestee'}, {required: true})
  requesteeId: string;

  @belongsTo(() => User, {name: 'requestor'}, {required: true})
  requestorId: string;

  constructor(data?: Partial<Friend>) {
    super(data);
  }
}

export interface FriendRelations {
  // describe navigational properties here
  requestee?: UserWithRelations;
  requestor?: UserWithRelations;
}

export type FriendWithRelations = Friend & FriendRelations;
