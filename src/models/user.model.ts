import {Entity, hasMany, model, property} from '@loopback/repository';
import {DefaultCurrencyType} from '../enums';
import {ActivityLog} from './activity-log.model';
import {Currency} from './currency.model';
import {Experience} from './experience.model';
import {Friend} from './friend.model';
import {UserCurrency} from './user-currency.model';
import {UserExperience} from './user-experience.model';

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
      pattern: '^0x',
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
    required: false,
    index: {
      unique: true,
    },
  })
  username?: string;

  @property({
    type: 'string',
    required: false,
  })
  profilePictureURL?: string;

  @property({
    type: 'string',
    required: false,
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
    type: 'string',
    required: false,
  })
  onTimeline?: string;

  @property({
    type: 'string',
    required: false,
    default: DefaultCurrencyType.AUSD,
  })
  defaultCurrency?: string;

  @property({
    type: 'string',
    required: false,
  })
  websiteURL?: string;

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

  @hasMany(() => Friend, {keyTo: 'requesteeId'})
  friends: Friend[];

  @hasMany(() => Experience, {
    through: {
      model: () => UserExperience,
      keyFrom: 'userId',
      keyTo: 'experienceId',
    },
  })
  experiences: Experience[];

  @hasMany(() => Currency, {
    through: {
      model: () => UserCurrency,
      keyFrom: 'userId',
      keyTo: 'currencyId',
    },
  })
  currencies: Currency[];

  @hasMany(() => ActivityLog)
  activityLogs: ActivityLog[];

  constructor(data?: Partial<User>) {
    super(data);
  }
}

export interface UserRelations {
  // describe navigational properties here
}

export type UserWithRelations = User & UserRelations;
