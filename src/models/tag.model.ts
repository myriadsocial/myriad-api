import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'tags',
    },
  }
})
export class Tag extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: false,
    required: true,
    jsonSchema: {
      maxLength: 50,
      minLength: 1,
    },
  })
  id: string;

  @property({
    type: 'boolean',
    default: false
  })
  hide: boolean;

  @property({
    type: 'number',
    required: false,
    default: 1,
  })
  count: number;

  @property({
    type: 'date',
    required: false,
  })
  created_at: string;

  @property({
    type: 'date',
    required: false,
  })
  updated_at: string;

  @property({
    type: 'date',
    required: false,
  })
  deleted_at?: string;

  constructor(data?: Partial<Tag>) {
    super(data);
  }
}

export interface TagRelations {
  // describe navigational properties here
}

export type TagWithRelations = Tag & TagRelations;
