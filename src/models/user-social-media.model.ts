import {belongsTo, Entity, Model, model, property} from '@loopback/repository';
import {PlatformType} from '../enums';
import {PeopleWithRelations} from './';
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
    hiddenProperties: ['connected'],
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

interface AdditionalProperty {
  connected?: boolean;
}

export type UserSocialMediaWithRelations = UserSocialMedia &
  UserSocialMediaRelations &
  AdditionalProperty;

export class SocialMediaVerificationDto extends Model {
  @property({
    type: 'string',
    required: true,
  })
  address: string;

  @property({
    type: 'string',
    jsonSchema: {
      enum: Object.values(PlatformType),
    },
    required: true,
  })
  platform: PlatformType;

  @property({
    type: 'string',
    required: true,
  })
  username: string;

  @property({
    type: 'number',
  })
  delay?: number;

  @property({
    type: 'number',
  })
  triesLeft?: number;

  constructor(data?: Partial<SocialMediaVerificationDto>) {
    super(data);
  }
}
