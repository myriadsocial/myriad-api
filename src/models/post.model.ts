import {
  belongsTo,
  Entity,
  hasMany,
  hasOne,
  model,
  property
} from '@loopback/repository';
import {Comment} from './comment.model';
import {Dislike} from './dislike.model';
import {Like} from './like.model';
import {People} from './people.model';
import {PublicMetric} from './public-metric.model';
import {User} from './user.model';
import {TipsReceived, PlatformUser, PlatformPublicMetric} from '../interfaces'
import {Transaction} from './transaction.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'posts',
    },
    hiddenProperties: ['walletAddress', 'total_comment', 'total_liked', 'total_disliked']
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
  id: string;

  @property({
    type: 'array',
    itemType: 'string',
    required: false,
    default: []
  })
  tags: string[];

  @property({
    type: 'object',
    required: false,
  })
  platform_user?: PlatformUser;

  @property({
    type: 'string',
    required: false,
    default: 'myriad'
  })
  platform?: string

  @property({
    type: 'object',
    required: false
  })
  platform_metric?: PlatformPublicMetric

  @property({
    type: 'string',
    required: false
  })
  title?: string

  @property({
    type: 'string',
    required: false
  })
  text?: string;

  @property({
    type: 'string',
    required: false,
  })
  text_id?: string;

  @property({
    type: 'boolean',
    required: false,
    default: false
  })
  has_media: boolean

  @property({
    type: 'string',
    required: false
  })
  link?: string

  @property({
    type: 'array',
    itemType: 'string',
    required: false
  })
  assets?: string[]

  @property({
    type: 'date',
    required: false,
  })
  platform_created_at: string

  @property({
    type: 'array',
    itemType: 'string',
    default: []
  })
  import_by: string[]

  @property({
    type: 'number',
    required: false,
    default: 0
  })
  total_comment?: number

  @property({
    type: 'number',
    required: false,
    default: 0
  })
  total_liked?: number

  @property({
    type: 'number',
    required: false,
    default: 0
  })
  total_disliked?: number

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

  @property({
    type: 'array',
    itemType: 'object',
    required: false,
    default: [
      {
        cryptocurrency_id: "MYR",
        total_tips: 0
      },
      {
        cryptocurrency_id: "AUSD",
        total_tips: 0
      }
    ]
  })
  tips_received: TipsReceived[]

  @belongsTo(() => User, {name: 'importer'})
  importer_id: string

  @belongsTo(() => User, {name: 'user'})
  walletAddress: string;

  @hasMany(() => Comment, {keyTo: 'post_id'})
  comments: Comment[];

  @belongsTo(() => People, {name: 'people'})
  people_id: string;

  @hasMany(() => Like, {keyTo: 'post_id'})
  likes: Like[];

  @hasOne(() => PublicMetric, {keyTo: 'post_id'})
  metric: PublicMetric;

  @hasMany(() => Dislike, {keyTo: 'post_id'})
  dislikes: Dislike[];

  @hasMany(() => Transaction, {keyTo: 'post_id'})
  transactions: Transaction[];

  constructor(data?: Partial<Post>) {
    super(data);
  }
}

export interface PostRelations {
  // describe navigational properties here
}

export type PostWithRelations = Post & PostRelations;
