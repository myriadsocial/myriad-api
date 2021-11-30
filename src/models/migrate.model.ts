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
      dataType: 'ObjectId',
    },
  })
  id?: string;
}

export interface PostImporterRelations {
  // describe navigational properties here
}

export type PostImporterWithRelations = PostImporter & PostImporterRelations;
