import {belongsTo, Entity, model, property} from '@loopback/repository';
import {User} from './user.model';

@model({
  settings: {
    mongodb: {
      collection: 'userOTPs',
    },
  },
})
export class UserOTP extends Entity {
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
    index: {
      unique: true,
    },
  })
  token: string;

  @property({
    type: 'date',
    required: false,
    default: () => {
      const now = Date.now();
      return new Date(now + 30 * 60 * 1000);
    },
  })
  expiredAt: string;

  @property({
    type: 'date',
    required: false,
    default: () => new Date(),
  })
  createdAt: string;

  @property({
    type: 'date',
    required: false,
    default: () => new Date(),
  })
  updatedAt: string;

  @property({
    type: 'date',
    required: false,
  })
  deletedAt?: string;

  @belongsTo(() => User)
  userId: string;

  constructor(data?: Partial<UserOTP>) {
    super(data);
  }
}

export interface UserOTPRelations {
  // describe navigational properties here
}

export type UserOTPithRelations = UserOTP & UserOTPRelations;
