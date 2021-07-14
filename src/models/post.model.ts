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
    hiddenProperties: ['walletAddress', 'totalComment', 'totalLiked', 'totalDisliked']
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
    default: []
  })
  tags: string[];

  @property({
    type: 'object',
    required: false,
  })
  platformUser?: PlatformUser;

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
  platformPublicMetric?: PlatformPublicMetric

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
  textId?: string;

  @property({
    type: 'boolean',
    required: false,
    default: false
  })
  hasMedia: boolean

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
  platformCreatedAt: string

  @property({
    type: 'number',
    required: false,
    default: 0
  })
  totalComment?: number

  @property({
    type: 'number',
    required: false,
    default: 0
  })
  totalLiked?: number

  @property({
    type: 'number',
    required: false,
    default: 0
  })
  totalDisliked?: number

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

  @property({
    type: 'array',
    itemType: 'string',
    required: false,
    default: []
  })
  importBy: string[]

  @property({
    type: 'array',
    itemType: 'object',
    required: false,
    default: [
      {
        tokenId: "MYR",
        totalTips: 0
      },
      {
        tokenId: "AUSD",
        totalTips: 0
      }
    ]
  })
  tipsReceived: TipsReceived[]

  @belongsTo(() => User, {name: 'user'})
  walletAddress: string;

  @hasMany(() => Comment)
  comments: Comment[];

  @belongsTo(() => People)
  peopleId: string;

  @hasMany(() => Like)
  likes: Like[];

  @hasOne(() => PublicMetric)
  publicMetric: PublicMetric;

  @hasMany(() => Dislike)
  dislikes: Dislike[];

  @hasMany(() => Transaction)
  transactions: Transaction[];

  constructor(data?: Partial<Post>) {
    super(data);
  }
}

export interface PostRelations {
  // describe navigational properties here
}

export type PostWithRelations = Post & PostRelations;
