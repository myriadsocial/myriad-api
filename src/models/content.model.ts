import {belongsTo, Entity, hasMany, model, property} from '@loopback/repository';
import {Comment} from './comment.model';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'contents',
    },
  }
})
export class Content extends Entity {
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
    type: 'array',
    itemType: 'string',
    required: false,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  topics?: String[];

  @property({
    type: 'string',
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  platformId?: string;

  @property({
    type: 'string',
    required: true,
    index: {
      unique: true
    },
  })
  url: string;

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

  @belongsTo(() => User, {}, {
    mongodb: {
      dataType: 'ObjectId'
    }
  })
  userId: string;

  @hasMany(() => Comment)
  comments: Comment[];

  constructor(data?: Partial<Content>) {
    super(data);
  }
}

export interface ContentRelations {
  // describe navigational properties here
}

export type ContentWithRelations = Content & ContentRelations;
