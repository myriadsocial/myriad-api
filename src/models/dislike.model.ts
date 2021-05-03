import {Entity, model, property, belongsTo} from '@loopback/repository';
import {User} from './user.model';
import {Post} from './post.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'dislikes'
    }
  }
})
export class Dislike extends Entity {
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
    type: 'boolean',
    required: false,
    default: false,
  })
  status?: boolean;

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
