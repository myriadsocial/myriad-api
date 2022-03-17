import {
  Entity,
  hasMany,
  model,
  property,
  hasOne,
  belongsTo,
} from '@loopback/repository';
import {DefaultCurrencyType, PermissionKeys} from '../enums';
import {UserMetric} from '../interfaces';
import {ActivityLog} from './activity-log.model';
import {Currency} from './currency.model';
import {Experience} from './experience.model';
import {Friend} from './friend.model';
import {UserCurrency} from './user-currency.model';
import {UserExperience} from './user-experience.model';
import {AccountSetting} from './account-setting.model';
import {NotificationSetting} from './notification-setting.model';
import {People} from './people.model';
import {UserSocialMedia} from './user-social-media.model';
import {ExperienceWithRelations} from './experience.model';
import {LanguageSetting} from './language-setting.model';
import {Wallet, WalletWithRelations} from './wallet.model';
import NonceGenerator from 'a-nonce-generator';

@model({
  settings: {
    mongodb: {
      collection: 'users',
    },
    indexes: {
      nameIndex: {
        keys: {
          name: 1,
        },
      },
    },
    hiddenProperties: ['nonce', 'permissions'],
  },
})
export class User extends Entity {
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
    jsonSchema: {
      minLength: 2,
    },
  })
  name: string;

  @property({
    type: 'string',
    required: true,
    index: {
      unique: true,
    },
    jsonSchema: {
      maxLength: 16,
    },
  })
  username: string;

  @property({
    type: 'string',
    required: false,
  })
  profilePictureURL?: string;

  @property({
    type: 'string',
    required: false,
    default:
      'https://res.cloudinary.com/dsget80gs/background/profile-default-bg.png',
  })
  bannerImageUrl?: string;

  @property({
    type: 'string',
    required: false,
    jsonSchema: {
      maxLength: 160,
    },
  })
  bio?: string;

  @property({
    type: 'string',
    required: false,
  })
  websiteURL?: string;

  @property({
    type: 'object',
    required: false,
    default: {
      totalPosts: 0,
      totalKudos: 0,
      totalFriends: 1,
      totalExperiences: 0,
    },
  })
  metric: UserMetric;

  @property({
    type: 'array',
    itemType: 'string',
    required: false,
    default: [],
  })
  fcmTokens?: string[];

  @property({
    type: 'boolean',
    required: false,
    default: false,
  })
  verified: boolean;

  @property({
    type: 'number',
    default: () => {
      const ng = new NonceGenerator();
      return ng.generate();
    },
  })
  nonce: number;

  @property({
    type: 'array',
    itemType: 'string',
    default: [PermissionKeys.USER],
  })
  permissions: PermissionKeys[];

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

  @hasMany(() => Friend, {keyTo: 'requestorId'})
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

  @hasOne(() => AccountSetting)
  accountSetting: AccountSetting;

  @hasOne(() => LanguageSetting)
  languageSetting: LanguageSetting;

  @hasOne(() => NotificationSetting)
  notificationSetting: NotificationSetting;

  @hasMany(() => People, {through: {model: () => UserSocialMedia}})
  people: People[];

  @hasMany(() => Wallet)
  wallets: Wallet[];

  @belongsTo(
    () => Currency,
    {name: 'currency'},
    {default: DefaultCurrencyType.MYRIA},
  )
  defaultCurrency: string;

  @belongsTo(() => Experience, {name: 'experience'}, {type: 'string'})
  onTimeline: string;

  constructor(data?: Partial<User>) {
    super(data);
  }
}

export interface UserRelations {
  // describe navigational properties here
  experience?: ExperienceWithRelations;
  wallets?: WalletWithRelations;
}

export type UserWithRelations = User & UserRelations;
