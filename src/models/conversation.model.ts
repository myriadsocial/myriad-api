import {belongsTo, Entity, model, property} from '@loopback/repository';
import {Post} from './post.model';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
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
    default: true
  })
  read: boolean;

  @property({
    type: 'number',
    required: false,
    default: 0
  })
  unread_message: number

  @property({
    type: 'date',
    required: false,
  })
  created_at: string

  @property({
    type: 'date',
    required: false,
  })
  updated_at: string

  @belongsTo(() => User, {name: 'user'})
  user_id: string;

  @belongsTo(() => Post, {name: 'post'})
  post_id: string;

  constructor(data?: Partial<Conversation>) {
    super(data);
  }
}

export interface ConversationRelations {
  // describe navigational properties here
}

export type ConversationWithRelations = Conversation & ConversationRelations;
