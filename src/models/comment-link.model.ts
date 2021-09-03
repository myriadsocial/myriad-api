import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strictObjectIDCoersion: true,
    mongodb: {
      collection: 'commentLinks',
    },
  },
})
export class CommentLink extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id?: string;

  @property({
    type: 'string',
  })
  fromCommentId: string;

  @property({
    type: 'string',
  })
  toCommentId: string;

  constructor(data?: Partial<CommentLink>) {
    super(data);
  }
}

export interface CommentLinkRelations {
  // describe navigational properties here
}

export type CommentLinkWithRelations = CommentLink & CommentLinkRelations;
