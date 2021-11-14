import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'postImporters',
    },
  },
})
export class PostImporter extends Entity {
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
    type: 'string',
  })
  postId?: string;

  @property({
    type: 'string',
  })
  importerId?: string;

  constructor(data?: Partial<PostImporter>) {
    super(data);
  }
}

export interface PostImporterRelations {
  // describe navigational properties here
}

export type PostImporterWithRelations = PostImporter & PostImporterRelations;
