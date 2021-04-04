import {Entity, hasMany, model, property} from '@loopback/repository';
import {Comment} from './comment.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'posts',
    },
  }
})
export class Post extends Entity {
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
  })
  tags?: string[];

  @property({
    type: 'object',
    required: false,
  })
  people?: object;

  @property({
    type: 'string',
    required: true
  })

  platform: string

  @property({
    type: 'string',
    required: true
  })
  text: string;

  @property({
    type: 'string',
    required: false,
  })
  textId: string;

  @property({
    type: 'boolean',
    required: false,
    default: false
  })

  hasMedia: boolean

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
  
  @property({
    type: 'string',
    required: false
  })
  link?: string

  @hasMany(() => Comment)
  comments: Comment[];

  constructor(data?: Partial<Post>) {
    super(data);
  }
}

export interface PostRelations {
  // describe navigational properties here
}

export type PostWithRelations = Post & PostRelations;
