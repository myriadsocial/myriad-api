// TODO: Add new model
import {Entity, model, property} from '@loopback/repository';

@model()
export class PlatformPost extends Entity {
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
  })
  tags: string[];

  constructor(data?: Partial<PlatformPost>) {
    super(data);
  }
}

export interface PlatformPostRelations {}

export type PlatformPostWithRelations = PlatformPost & PlatformPostRelations;
