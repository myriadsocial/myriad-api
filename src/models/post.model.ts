import {belongsTo, Entity, hasMany, hasOne, model, property} from '@loopback/repository';
import {Comment} from './comment.model';
import {Dislike} from './dislike.model';
import {Like} from './like.model';
import {People, PeopleWithRelations} from './people.model';
import {PublicMetric} from './public-metric.model';
import {User} from './user.model';
import {Transaction} from './transaction.model';
import {PlatformUser} from '../interfaces';
import {PostTip} from './post-tip.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'posts',
    },
    hiddenProperties: ['walletAddress', 'totalComment', 'totalLiked', 'totalDisliked'],
  },
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
    default: [],
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
    default: 'myriad',
  })
  platform?: string;

  @property({
    type: 'string',
    required: false,
    default: null,
  })
  title?: string;

  @property({
    type: 'string',
    required: false,
    default: null,
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
    default: false,
  })
  hasMedia?: boolean;

  @property({
    type: 'string',
    required: false,
    default: null,
  })
  link?: string;

  @property({
    type: 'array',
    itemType: 'string',
    required: false,
    default: [],
  })
  assets?: string[];

  @property({
    type: 'date',
    required: false,
  })
  platformCreatedAt?: string;

  @property({
    type: 'array',
    itemType: 'string',
    default: [],
  })
  importBy: string[];

  @property({
    type: 'number',
    required: false,
    default: 0,
  })
  totalComment?: number;

  @property({
    type: 'number',
    required: false,
    default: 0,
  })
  totalLiked?: number;

  @property({
    type: 'number',
    required: false,
    default: 0,
  })
  totalDisliked?: number;

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

  @belongsTo(() => User, {name: 'importer'})
  importerId: string;

  @belongsTo(() => User, {name: 'user'})
  walletAddress: string;

  @hasMany(() => Comment)
  comments: Comment[];

  @belongsTo(() => People)
  peopleId: string;

  @hasMany(() => Like)
  likes: Like[];

  @hasOne(() => PublicMetric)
  metric: PublicMetric;

  @hasMany(() => Dislike)
  dislikes: Dislike[];

  @hasMany(() => Transaction)
  transactions: Transaction[];

  @hasMany(() => PostTip)
  postTips: PostTip[];

  constructor(data?: Partial<Post>) {
    super(data);
  }
}

export interface PostRelations {
  // describe navigational properties here
  people: PeopleWithRelations;
}

export type PostWithRelations = Post & PostRelations;
