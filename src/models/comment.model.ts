import {belongsTo, Entity, hasMany, model, property} from '@loopback/repository';
import {CommentLink} from './comment-link.model';
import {Post} from './post.model';
import {Transaction} from './transaction.model';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'comments',
    },
  },
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
    default: () => new Date(),
  })
  createdAt?: string;

  @property({
    type: 'date',
    required: false,
    default: () => new Date(),
  })
  updatedAt?: string;

  @property({
    type: 'date',
    required: false,
  })
  deletedAt?: string;

  @hasMany(() => Transaction, {keyTo: 'referenceId'})
  transactions: Transaction[];

  @belongsTo(() => Post, {}, {required: true})
  postId: string;

  @belongsTo(
    () => User,
    {},
    {
      jsonSchema: {
        maxLength: 66,
        minLength: 66,
        pattern: '^0x',
      },
      required: true,
    },
  )
  userId: string;

  @hasMany(() => Comment, {
    through: {
      model: () => CommentLink,
      keyFrom: 'fromCommentId',
      keyTo: 'toCommentId',
    },
  })
  comments: Comment[];

  constructor(data?: Partial<Comment>) {
    super(data);
  }
}

export interface CommentRelations {
  // describe navigational properties here
}

export type CommentWithRelations = Comment & CommentRelations;
