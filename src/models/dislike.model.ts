import {belongsTo, Entity, model, property} from '@loopback/repository';
import {Post} from './post.model';
import {User} from './user.model';

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
    required: false
  })
  status: boolean;

  @belongsTo(() => User, {name: 'user'})
  user_id: string;

  @belongsTo(() => Post, {name: 'post'})
  post_id: string;

  constructor(data?: Partial<Dislike>) {
    super(data);
  }
}

export interface DislikeRelations {
  // describe navigational properties here
}

export type DislikeWithRelations = Dislike & DislikeRelations;
