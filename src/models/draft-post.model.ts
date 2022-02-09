import {Entity, model, property} from '@loopback/repository';
import {EmbeddedURL, MentionUser} from '.';
import {PostStatus, VisibilityType} from '../enums';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'draftPosts',
    },
    indexes: {
      uniqueCreatedByIndex: {
        keys: {
          createdBy: 1,
        },
        options: {
          unique: true,
        },
      },
    },
    hiddenProperties: ['rawText'],
  },
})
export class DraftPost extends Entity {
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
  })
  text?: string;

  @property({
    type: 'string',
    required: false,
  })
  rawText?: string;

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
    type: 'string',
    required: true,
  })
  createdBy: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: Object.values(PostStatus),
    },
  })
  status: PostStatus;

  constructor(data?: Partial<DraftPost>) {
    super(data);
  }
}

export interface DraftPostRelations {
  // describe navigational properties here
}

export type DraftPostWithRelations = DraftPost & DraftPostRelations;
