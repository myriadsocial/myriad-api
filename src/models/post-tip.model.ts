// TODO: Add new PostTip model
import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'postTip',
    },
  },
})
export class PostTip extends Entity {
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
    type: 'number',
    default: 0,
  })
  total: number;

  @property({
    type: 'string',
  })
  postId?: string;

  @property({
    type: 'string',
  })
  cryptocurrencyId?: string;

  constructor(data?: Partial<PostTip>) {
    super(data);
  }
}

export interface PostTipRelations {
  // describe navigational properties here
}

export type PostTipWithRelations = PostTip & PostTipRelations;
