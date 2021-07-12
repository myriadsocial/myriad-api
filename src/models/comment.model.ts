import {belongsTo, Entity, model, property} from '@loopback/repository';
import {Post} from './post.model';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'comments',
    }
  }
})
export class Comment extends Entity {
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
  })
  text: string;

  @property({
    type: 'date',
    required: false,
  })
  created_at?: string;

  @property({
    type: 'date',
    required: false,
  })
  updated_at?: string;

  @property({
    type: 'date',
    required: false,
  })
  deleted_at?: string;

  @belongsTo(() => Post, {
    name: 'post'
  }, {
    mongodb: {
      dataType: 'ObjectId'
    }
  })
  post_id: string;

  @belongsTo(() => User, {name: 'user'})
  user_id: string;

  constructor(data?: Partial<Comment>) {
    super(data);
  }
}

export interface CommentRelations {
  // describe navigational properties here
}

export type CommentWithRelations = Comment & CommentRelations;
