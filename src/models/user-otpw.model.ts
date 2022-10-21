import {Entity, model, property, belongsTo} from '@loopback/repository';
import {User} from './user.model';

@model({
  settings: {
    mongodb: {
      collection: 'userOTPWs',
    },
  },
})
export class UserOtpw extends Entity {
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
    type: 'date',
    required: false,
    default: () => new Date(new Date().getTime() + 30 * 60000),
  })
  expiredAt: string;

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

  constructor(data?: Partial<UserOtpw>) {
    super(data);
  }
}

export interface UserOtpwRelations {
  // describe navigational properties here
}

export type UserOtpwWithRelations = UserOtpw & UserOtpwRelations;
