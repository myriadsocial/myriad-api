import {Entity, model, property, belongsTo} from '@loopback/repository';
import {Post} from './post.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collections: 'assets'
    }
  }
})

export class Asset extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId'
    }
  })
  id?: string;

  @property({
    type: 'array',
    itemType: 'string',
    required: false,
    default: []
  })
  media_urls?: string[];

  @belongsTo(() => Post)
  postId: string;

  constructor(data?: Partial<Asset>) {
    super(data);
  }
}

export interface AssetRelations {
  // describe navigational properties here
}

export type AssetWithRelations = Asset & AssetRelations;
