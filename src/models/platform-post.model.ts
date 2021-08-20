import {Model, model, property} from '@loopback/repository';

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

  constructor(data?: Partial<PlatformPost>) {
    super(data);
  }
}

export interface PlatformPostRelations {}

export type PlatformPostWithRelations = PlatformPost & PlatformPostRelations;
