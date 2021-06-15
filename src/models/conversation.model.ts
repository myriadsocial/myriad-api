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
