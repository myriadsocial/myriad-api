import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'platforms',
    },
  }
})
export class Platform extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: false,
    required: true,
    index: {
      unique: true
    },
    jsonSchema: {
      maxLength: 50,
      minLength: 1,
    },
  })
  id: string;

  @property({
    type: 'date',
    required: true,
  })
  createdAt: string;

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

  constructor(data?: Partial<Platform>) {
    super(data);
  }
}

export interface PlatformRelations {
  // describe navigational properties here
}

export type PlatformWithRelations = Platform & PlatformRelations;
