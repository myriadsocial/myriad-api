import {belongsTo, Entity, model, property} from '@loopback/repository';
import {Post} from './post.model';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'dislikes',
    },
  },
})
export class Dislike extends Entity {
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
    type: 'boolean',
    required: false,
  })
  status: boolean;

  @belongsTo(() => User)
  userId: string;

  @belongsTo(() => Post)
  postId: string;

  constructor(data?: Partial<Dislike>) {
    super(data);
  }
}

export interface DislikeRelations {
  // describe navigational properties here
}

export type DislikeWithRelations = Dislike & DislikeRelations;
