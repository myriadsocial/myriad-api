import {belongsTo, Entity, model, property} from '@loopback/repository';
import {ReferenceType, SectionType} from '../enums';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'votes',
    },
    hiddenProperties: ['toUserId'],
    indexes: {
      toUserIdIndex: {
        keys: {
          toUserId: 1,
        },
      },
      userIdIndex: {
        keys: {
          userId: 1,
        },
      },
      postIdIndex: {
        keys: {
          postId: 1,
        },
      },
      voteStateIndex: {
        keys: {
          type: 1,
          referenceId: 1,
          state: 1,
        },
      },
      uniqueVoteIndex: {
        keys: {
          userId: 1,
          type: 1,
          referenceId: 1,
        },
        options: {
          unique: true,
        },
      },
    },
  },
})
export class Vote extends Entity {
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
      enum: Object.values(ReferenceType),
    },
  })
  type: ReferenceType;

  @property({
    type: 'string',
    required: true,
  })
  referenceId: string;

  @property({
    type: 'string',
    required: true,
  })
  postId: string;

  @property({
    type: 'string',
    jsonSchema: {
      enum: Object.values(SectionType),
    },
    required: false,
  })
  section?: SectionType;

  @property({
    type: 'boolean',
    required: true,
  })
  state: boolean;

  @property({
    type: 'string',
    required: false,
    jsonSchema: {
      maxLength: 66,
      minLength: 66,
      pattern: '^0x',
    },
  })
  toUserId: string;

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

  @belongsTo(() => User, {}, {required: true})
  userId: string;

  constructor(data?: Partial<Vote>) {
    super(data);
  }
}

export interface VoteRelations {
  // describe navigational properties here
}

export type VoteWithRelations = Vote & VoteRelations;
