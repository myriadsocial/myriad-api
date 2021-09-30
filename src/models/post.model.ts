import {belongsTo, Entity, hasMany, model, property} from '@loopback/repository';
import {PlatformType, VisibilityType} from '../enums';
import {Metric} from '../interfaces';
import {Asset} from '../interfaces/asset.interface';
import {Comment} from './comment.model';
import {EmbeddedURL} from './embedded-url.model';
import {Vote} from './vote.model';
import {People, PeopleWithRelations} from './people.model';
import {Transaction} from './transaction.model';
import {User} from './user.model';
import {MentionUser} from './mention-user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'posts',
    },
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
    jsonSchema: {
      enum: Object.values(PlatformType),
    },
  })
  platform?: PlatformType;

  @property({
    type: 'string',
    required: false,
  })
  title?: string;

  @property({
    type: 'string',
    required: false,
    jsonSchema: {
      minLength: 1,
      maxLength: 5000,
    },
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
  })
  url?: string;

  @property({
    type: 'object',
    required: false,
    default: {
      videos: [],
      images: [],
    },
  })
  asset?: Asset;

  @property({
    type: 'date',
    required: false,
    default: () => new Date(),
  })
  originCreatedAt?: string;

  @property({
    type: 'array',
    itemType: 'string',
    default: [],
  })
  importers: string[];

  @property({
    type: 'object',
    default: {
      upvotes: 0,
      downvotes: 0,
      discussions: 0,
      debates: 0,
      shares: 0,
    },
  })
  metric: Metric;

  @property({
    type: 'object',
    require: false,
  })
  embeddedURL?: EmbeddedURL;

  @property({
    type: 'boolean',
    require: false,
    default: false,
  })
  isNSFW?: boolean;

  @property({
    type: 'string',
    require: false,
  })
  NSFWTag?: string;

  @property({
    type: 'string',
    required: false,
    default: VisibilityType.PUBLIC,
    jsonSchema: {
      enum: Object.values(VisibilityType),
    },
  })
  visibility?: VisibilityType;

  @property({
    type: 'array',
    itemType: 'object',
    required: false,
    default: [],
  })
  mentions: MentionUser[];

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

  @belongsTo(
    () => User,
    {name: 'user'},
    {
      jsonSchema: {
        maxLength: 66,
        minLength: 66,
        pattern: '^0x',
      },
      required: true,
    },
  )
  createdBy: string;

  @belongsTo(() => People)
  peopleId: string;

  @hasMany(() => Comment, {keyTo: 'referenceId'})
  comments: Comment[];

  @hasMany(() => Vote, {keyTo: 'referenceId'})
  votes: Vote[];

  @hasMany(() => Transaction, {keyTo: 'referenceId'})
  transactions: Transaction[];

  constructor(data?: Partial<Post>) {
    super(data);
  }
}

export interface PostRelations {
  // describe navigational properties here
  people?: PeopleWithRelations;
}

export type PostWithRelations = Post & PostRelations;
