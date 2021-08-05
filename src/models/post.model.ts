import {belongsTo, Entity, hasMany, model, property} from '@loopback/repository';
import {Asset} from '../interfaces/asset.interface';
import {Comment} from './comment.model';
import {People, PeopleWithRelations} from './people.model';
import {Transaction} from './transaction.model';
import {User} from './user.model';

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
  originPostId?: string;

  @property({
    type: 'string',
    required: false,
    default: null,
  })
  url?: string;

  @property({
    type: 'object',
    required: false,
  })
  asset?: Asset;

  @property({
    type: 'date',
    required: false,
  })
  originCreatedAt?: string;

  @property({
    type: 'array',
    itemType: 'string',
    default: [],
  })
  importers: string[];

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

  @belongsTo(() => User)
  createdBy: string;

  @belongsTo(() => People)
  peopleId: string;

  @hasMany(() => Comment)
  comments: Comment[];

  @hasMany(() => Transaction)
  transactions: Transaction[];

  constructor(data?: Partial<Post>) {
    super(data);
  }
}

export interface PostRelations {
  // describe navigational properties here
  people: PeopleWithRelations;
}

export type PostWithRelations = Post & PostRelations;
