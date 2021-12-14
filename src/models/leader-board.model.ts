import {Entity, model, property, belongsTo} from '@loopback/repository';
import {UserWithRelations} from '.';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'leaderboards',
    },
  },
})
export class LeaderBoard extends Entity {
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
    required: true,
    default: 0,
  })
  totalActivity: number;

  @belongsTo(() => User)
  userId: string;

  constructor(data?: Partial<LeaderBoard>) {
    super(data);
  }
}

export interface LeaderBoardRelations {
  // describe navigational properties here
  user?: UserWithRelations;
}

export type LeaderBoardWithRelations = LeaderBoard & LeaderBoardRelations;
