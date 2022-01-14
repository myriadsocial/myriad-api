import {belongsTo, Entity, model, property} from '@loopback/repository';
import {PeopleWithRelations} from './';
import {PlatformType} from '../enums';
import {People} from './people.model';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'userSocialMedias',
    },
    indexes: {
      uniquePeopleIdIndex: {
        keys: {
          peopleId: 1,
        },
        options: {
          unique: true,
        },
      },
      userIdIndex: {
        keys: {
          userId: 1,
        },
      },
      unique: {
        keys: {
          userId: 1,
          peopleId: 1,
        },
        options: {
          unique: true,
        },
      },
    },
  },
})
export class UserSocialMedia extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id: string;

  @property({
    type: 'boolean',
    required: true,
  })
  verified: boolean;

  @property({
    type: 'string',
    jsonSchema: {
      enum: Object.values(PlatformType),
    },
  })
  platform: PlatformType;

  @property({
    type: 'boolean',
    default: false,
    required: false,
  })
  primary: boolean;

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

  @belongsTo(() => People)
  peopleId: string;

  @belongsTo(() => User)
  userId: string;

  constructor(data?: Partial<UserSocialMedia>) {
    super(data);
  }
}

export interface UserSocialMediaRelations {
  // describe navigational properties here
  people?: PeopleWithRelations;
}

export type UserSocialMediaWithRelations = UserSocialMedia &
  UserSocialMediaRelations;
