import {belongsTo, Entity, hasMany, model, property, hasOne} from '@loopback/repository';
import {Comment} from './comment.model';
import {People} from './people.model';
import {Asset} from './asset.model';
import {User} from './user.model';
import {Like} from './like.model';
import {PublicMetric} from './public-metric.model';
import {Dislike} from './dislike.model';

interface PlatformUser {
  username: string;
  platform_account_id: string;
  profile_image_url?: string;
}

interface PlatformPublicMetric {
  retweet_count?: number,
  like_count?: number,
  upvote_count?: number,
  downvote_count?: number
}

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'posts',
    },
    hiddenProperties: ['wallet_address']
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
    type: 'number',
    required: false,
    default: 0
  })
  tipsReceived: number

  @belongsTo(() => User, {name: 'user'})
  walletAddress: string;

  @hasMany(() => Comment)
  comments: Comment[];

  @belongsTo(() => People)
  peopleId: string;

  @hasOne(() => Asset)
  asset: Asset;

  @hasMany(() => Like)
  likes: Like[];

  @hasOne(() => PublicMetric)
  publicMetric: PublicMetric;

  @hasMany(() => Dislike)
  dislikes: Dislike[];

  constructor(data?: Partial<Post>) {
    super(data);
  }
}

export interface PostRelations {
  // describe navigational properties here
}

export type PostWithRelations = Post & PostRelations;
