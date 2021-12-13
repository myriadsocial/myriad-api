import {Entity, hasMany, hasOne, model, property} from '@loopback/repository';
import {PlatformType} from '../enums';
import {Post} from './post.model';
import {UserSocialMedia} from './user-social-media.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'people',
    },
    hiddenProperties: ['walletAddressPassword'],
  },
})
export class People extends Entity {
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
    type: 'string',
    required: false,
  })
  name?: string;

  @property({
    type: 'string',
    required: true,
  })
  username: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: Object.values(PlatformType),
    },
  })
  platform: PlatformType;

  @property({
    type: 'string',
    required: true,
  })
  originUserId: string;

  @property({
    type: 'string',
    required: false,
  })
  profilePictureURL: string;

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

  @property({
    type: 'string',
  })
  walletAddressPassword?: string;

  @hasOne(() => UserSocialMedia)
  userSocialMedia: UserSocialMedia;

  @hasMany(() => Post)
  posts: Post[];

  constructor(data?: Partial<People>) {
    super(data);
  }
}

export interface PeopleRelations {
  // describe navigational properties here
}

export type PeopleWithRelations = People & PeopleRelations;
