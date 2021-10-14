import {
  Entity,
  model,
  property,
} from '@loopback/repository';
import {PlatformType, VisibilityType} from '../enums';
import {Metric} from '../interfaces';
import {Asset} from '../interfaces/asset.interface';
import {EmbeddedURL} from './embedded-url.model';
import {MentionUser} from './mention-user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'posts',
    },
    hiddenProperties: ['popularCount'],
  },
})
export class GunPost extends Entity {
  @property({
    type: 'string',
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
    type: 'number',
    required: false,
    default: 0,
  })
  popularCount: number;

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

  constructor(data?: Partial<GunPost>) {
    super(data);
  }
}
