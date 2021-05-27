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
    required: false
  })
  count: number;

  @property({
    type: 'date',
    required: false,
  })
  createdAt: string;

  @property({
    type: 'date',
    required: false,
  })
  updatedAt: string;

  @property({
    type: 'date',
    required: false,
  })
  deletedAt?: string;

  constructor(data?: Partial<Tag>) {
    super(data);
  }
}

export interface TagRelations {
  // describe navigational properties here
}

export type TagWithRelations = Tag & TagRelations;
