import {belongsTo, Entity, model, property} from '@loopback/repository';
import {PlatformType} from '../enums';
import {People} from './people.model';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'userCredentials',
    },
  },
})
export class UserCredential extends Entity {
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
    type: 'boolean',
    required: true,
  })
  isVerified: boolean;

  @property({
    type: 'string',
    jsonSchema: {
      enum: Object.values(PlatformType),
    },
  })
  platform: PlatformType;

  @belongsTo(() => People)
  peopleId: string;

  @belongsTo(() => User)
  userId: string;

  constructor(data?: Partial<UserCredential>) {
    super(data);
  }
}

export interface UserCredentialRelations {
  // describe navigational properties here
}

export type UserCredentialWithRelations = UserCredential & UserCredentialRelations;
