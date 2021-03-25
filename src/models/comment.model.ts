import {belongsTo, Entity, model, property} from '@loopback/repository';
import {Content} from './content.model';
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

  @belongsTo(() => Content, {}, {
    mongodb: {
      dataType: 'ObjectId'
    }
  })
  contentId: string;

  @belongsTo(() => User, {}, {
    mongodb: {
      dataType: 'ObjectId'
    }
  })
  userId: string;

  constructor(data?: Partial<Comment>) {
    super(data);
  }
}

export interface CommentRelations {
  // describe navigational properties here
}

export type CommentWithRelations = Comment & CommentRelations;
