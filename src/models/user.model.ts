import {Entity, hasMany, model, property} from '@loopback/repository';
import {Comment} from './comment.model';
import {Content} from './content.model';
import {Experience} from './experience.model';
import {Platform} from './platform.model';
import {Topic} from './topic.model';
import {UserCredential} from './user-credential.model';
import {UserIdentity} from './user-identity.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'users',
    },
  }
})
export class User extends Entity {
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
  accountAddress: string;

  @property({
    type: 'string',
    required: true,
  })
  name: string;

  @property({
    type: 'array',
    itemType: 'string',
    required: false,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  corpus?: String[];

  @property({
    type: 'array',
    itemType: 'string',
    required: false,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  following?: String[];

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

  @hasMany(() => UserCredential)
  userCredentials: UserCredential[];

  @hasMany(() => UserIdentity)
  userIdentities: UserIdentity[];

  @hasMany(() => Topic)
  topics: Topic[];

  @hasMany(() => Platform)
  platforms: Platform[];

  @hasMany(() => Content)
  contents: Content[];

  @hasMany(() => Comment)
  comments: Comment[];

  @hasMany(() => Experience)
  experiences: Experience[];

  constructor(data?: Partial<User>) {
    super(data);
  }
}

export interface UserRelations {
  // describe navigational properties here
}

export type UserWithRelations = User & UserRelations;
