import {Entity, model, property, belongsTo} from '@loopback/repository';
import {User} from './user.model';

@model({
  settings: {
    mongodb: {
      collection: 'userPersonalAccessTokens',
    },
  },
})
export class UserPersonalAccessToken extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id: string;

  @property({
    type: 'string',
    required: true,
  })
  token: string;

  @property({
    type: 'string',
    required: true,
  })
  description: string;

  @property({
    type: 'array',
    itemType: 'string',
    required: true,
  })
  scopes: string[];

  @property({
    type: 'date',
    required: false,
    default: () => new Date(),
  })
  createdAt?: string;

  @property({
    type: 'date',
    required: false,
    default: () => new Date(),
  })
  updatedAt?: string;

  @property({
    type: 'date',
    required: false,
  })
  deletedAt?: string;

  @belongsTo(() => User)
  userId: string;

  constructor(data?: Partial<UserPersonalAccessToken>) {
    super(data);
  }
}

export interface UserPersonalAccessTokenRelations {
  // describe navigational properties here
}

export type UserPersonalAccessTokenWithRelations = UserPersonalAccessToken &
  UserPersonalAccessTokenRelations;
