import {
  belongsTo,
  Entity,
  hasMany,
  model,
  property,
} from '@loopback/repository';
import {MentionUser, UserWithRelations, Vote} from '.';
import {ReferenceType, SectionType} from '../enums';
import {Metric} from '../interfaces';
import {CommentLink} from './comment-link.model';
import {Transaction} from './transaction.model';
import {User} from './user.model';
import {Post, PostWithRelations} from './post.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'comments',
    },
    indexes: {
      userIdIndex: {
        keys: {
          userId: 1,
        },
      },
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
    type: 'array',
    itemType: 'object',
    required: false,
    default: [],
  })
  mentions: MentionUser[];

  @property({
    type: 'string',
    jsonSchema: {
      enum: Object.values(ReferenceType),
    },
    required: true,
  })
  type: ReferenceType;

  @property({
    type: 'string',
    required: true,
  })
  referenceId: string;

  @property({
    type: 'string',
    jsonSchema: {
      enum: Object.values(SectionType),
    },
    required: true,
  })
  section: SectionType;

  @property({
    type: 'object',
    default: {
      upvotes: 0,
      downvotes: 0,
      comments: 0,
    },
  })
  metric: Metric;

  @property({
    type: 'boolean',
    default: false,
    required: false,
  })
  deleteByUser: boolean;

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

  @belongsTo(() => User, {}, {required: true})
  userId: string;

  @belongsTo(() => Post, {}, {required: true})
  postId: string;

  @hasMany(() => Comment, {
    through: {
      model: () => CommentLink,
      keyFrom: 'fromCommentId',
      keyTo: 'toCommentId',
    },
  })
  comments: Comment[];

  @hasMany(() => Vote, {keyTo: 'referenceId'})
  votes: Vote[];

  @hasMany(() => Transaction, {keyTo: 'referenceId'})
  transactions: Transaction[];

  constructor(data?: Partial<Comment>) {
    super(data);
  }
}

export interface CommentRelations {
  // describe navigational properties here
  user?: UserWithRelations;
  post?: PostWithRelations;
}

export type CommentWithRelations = Comment & CommentRelations;
