import {Entity, hasMany, model, property} from '@loopback/repository';
import {Comment} from './comment.model';
import {Experience} from './experience.model';

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
      maxLength: 48,
      minLength: 48,
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

  constructor(data?: Partial<User>) {
    super(data);
  }
}

export interface UserRelations {
  // describe navigational properties here
}

export type UserWithRelations = User & UserRelations;
