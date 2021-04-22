import {Entity, hasMany, model, property} from '@loopback/repository';
import {Comment} from './comment.model';
import {Experience} from './experience.model';
import {SavedExperience} from './saved-experience.model';
import {UserCredential} from './user-credential.model';

@model({
  settings: {
    mongodb: {
      collection: 'users',
    },
  }
})
export class User extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: false,
    required: true,
    jsonSchema: {
      maxLength: 49,
      minLength: 49,
    },
  })
  id: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      maxLength: 30,
      minLength: 3,
    },
  })
  name: string;

  @property({
    type: 'string',
    required: false,
  })
  profilePictureURL?: string;

  @property({
    type: 'boolean',
    required: false,
    default: false,
  })
  anonymous?: boolean;

  @property({
    type: 'string',
    required: false
  })
  bio?: string; 

  @property({
    type: 'date',
    required: true,
  })
  createdAt: string;

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

  @hasMany(() => Experience)
  experiences: Experience[];

  @hasMany(() => Comment)
  comments: Comment[];

  @hasMany(() => Experience, {through: {model: () => SavedExperience, keyFrom: 'user_id', keyTo: 'experience_id'}})
  savedExperiences: Experience[];

  @hasMany(() => UserCredential)
  userCredentials: UserCredential[];

  constructor(data?: Partial<User>) {
    super(data);
  }
}

export interface UserRelations {
  // describe navigational properties here
}

export type UserWithRelations = User & UserRelations;
