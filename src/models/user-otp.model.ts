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
    type: 'number',
    required: true,
    index: {
      unique: true,
    },
    default: () => Math.floor(100000 + Math.random() * 900000),
  })
  otp: number;

  @property({
    type: 'date',
    required: true,
    default: () => new Date(new Date().getTime() + 30 * 60000),
  })
  expiredAt?: string;

  @property({
    type: 'date',
    required: true,
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

  constructor(data?: Partial<UserOTP>) {
    super(data);
  }
}

export interface UserOTPRelations {
  // describe navigational properties here
}

export type UserOTPithRelations = UserOTP & UserOTPRelations;
