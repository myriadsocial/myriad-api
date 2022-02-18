import {Model, model, property} from '@loopback/repository';
import {VisibilityType} from '../enums';
import {ExtendedPost} from '../interfaces';

@model()
export class PlatformPost extends Model {
  @property({
    type: 'string',
    required: true,
  })
  url: string;

  @property({
    type: 'string',
    required: true,
  })
  importer: string;

  @property({
    type: 'array',
    itemType: 'string',
    required: false,
  })
  tags?: string[];

  @property({
    type: 'string',
    required: false,
    jsonSchema: {
      enum: Object.values(VisibilityType),
    },
  })
  visibility?: VisibilityType;

  @property({
    type: 'string',
    require: false,
  })
  NSFWTag?: string;

  @property({
    type: 'object',
    required: false,
  })
  rawPost: ExtendedPost;

  constructor(data?: Partial<PlatformPost>) {
    super(data);
  }
}

export interface PlatformPostRelations {}

export type PlatformPostWithRelations = PlatformPost & PlatformPostRelations;
