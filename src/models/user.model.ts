import {Entity, hasMany, model, property} from '@loopback/repository';
import {Currency} from './currency.model';
import {Friend} from './friend.model';
import {UserCredential} from './user-credential.model';
import {UserCurrency} from './user-currency.model';

@model({
  settings: {
    mongodb: {
      collection: 'users',
    },
  },
})
export class User extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: false,
    required: true,
    jsonSchema: {
      maxLength: 66,
      minLength: 66,
    },
  })
  id: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      minLength: 3,
    },
  })
  name: string;

  @property({
    type: 'string',
  })
  profilePictureURL?: string;

  @property({
    type: 'string',
    required: false,
    default: null,
  })
  bannerImageUrl?: string;

  @property({
    type: 'string',
    required: false,
  })
  bio?: string;

  @property({
    type: 'array',
    itemType: 'string',
    required: false,
    default: [],
  })
  fcmTokens?: string[];

  @property({
    type: 'date',
  })
  createdAt?: string;

  @property({
    type: 'date',
  })
  updatedAt?: string;

  @property({
    type: 'date',
  })
  deletedAt?: string;

  @hasMany(() => UserCredential)
  userCredentials: UserCredential[];

  @hasMany(() => Friend)
  friends: Friend[];

  @hasMany(() => Currency, {
    through: {
      model: () => UserCurrency,
      keyFrom: 'userId',
      keyTo: 'currencyId',
    },
  })
  currencies: Currency[];

  constructor(data?: Partial<User>) {
    super(data);
  }
}

export interface UserRelations {
  // describe navigational properties here
}

export type UserWithRelations = User & UserRelations;
