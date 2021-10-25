import {belongsTo, Entity, model, property} from '@loopback/repository';
import {FriendStatusType} from '../enums';
import {User, UserWithRelations} from './user.model';

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

  @belongsTo(
    () => User,
    {name: 'requestee'},
    {
      jsonSchema: {
        maxLength: 66,
        minLength: 66,
        pattern: '^0x',
      },
      required: true,
    },
  )
  requesteeId: string;

  @belongsTo(
    () => User,
    {name: 'requestor'},
    {
      jsonSchema: {
        maxLength: 66,
        minLength: 66,
        pattern: '^0x',
      },
      required: true,
    },
  )
  requestorId: string;

  constructor(data?: Partial<Friend>) {
    super(data);
  }
}

export interface FriendRelations {
  // describe navigational properties here
  requestee: UserWithRelations;
  requestor: UserWithRelations;
}

export type FriendWithRelations = Friend & FriendRelations;
