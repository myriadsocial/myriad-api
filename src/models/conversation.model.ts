import {Entity, model, property, belongsTo} from '@loopback/repository';
import {User} from './user.model';
import {Post} from './post.model';

@model({
  settings: {
    mongodb: {
      collection: 'conversations'
    }
  }
})
export class Conversation extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId'
    }
  })
  id?: string;

  @property({
    type: 'boolean',
    required: false,
    default: false
  })
  read: boolean;

  @property({
    type: 'number',
    required: false,
    default: 1
  })
  unreadMessage: number

  @property({
    type: 'date',
    required: false,
  })
  createdAt: string

  @property({
    type: 'date',
    required: false,
  })
  updatedAt: string

  @belongsTo(() => User)
  userId: string;

  @belongsTo(() => Post)
  postId: string;

  constructor(data?: Partial<Conversation>) {
    super(data);
  }
}

export interface ConversationRelations {
  // describe navigational properties here
}

export type ConversationWithRelations = Conversation & ConversationRelations;
