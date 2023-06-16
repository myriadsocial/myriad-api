import {
  AnyObject,
  belongsTo,
  Entity,
  hasMany,
  hasOne,
  Model,
  model,
  property,
} from '@loopback/repository';
import NonceGenerator from 'a-nonce-generator';
import {PermissionKeys} from '../enums';
import {UserMetric} from '../interfaces';
import {AccountSetting} from './account-setting.model';
import {ActivityLog} from './activity-log.model';
import {Currency} from './currency.model';
import {Experience, ExperienceWithRelations} from './experience.model';
import {Friend} from './friend.model';
import {LanguageSetting} from './language-setting.model';
import {NotificationSetting} from './notification-setting.model';
import {People} from './people.model';
import {UserCurrency} from './user-currency.model';
import {UserExperience} from './user-experience.model';
import {UserSocialMedia} from './user-social-media.model';
import {Wallet, WalletWithRelations} from './wallet.model';
import {Post} from './post.model';

@model({
  settings: {
    mongodb: {
      collection: 'users',
    },
    indexes: {
      uniqueEmail: {
        keys: {
          email: 1,
        },
        options: {
          unique: true,
          sparse: true,
        },
      },
      nameIndex: {
        keys: {
          name: 1,
        },
      },
    },
    hiddenProperties: ['permissions', 'friendIndex', 'additionalEmail'],
  },
})
export class User extends Entity {
  @property({
    type: 'string',
    id: true,
    required: false,
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
      maxLength: 22,
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
    jsonSchema: {
      minLength: 5,
    },
  })
  email?: string;

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
  bannerImageURL?: string;

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
      totalComments: 0,
      totalPosts: 0,
      totalKudos: 0,
      totalSubscriptions: 0,
      totalFriends: 0,
      totalExperiences: 0,
      totalTransactions: 0,
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
    type: 'boolean',
    default: false,
  })
  fullAccess: boolean;

  @property({
    type: 'object',
    required: false,
    default: {},
  })
  friendIndex: AnyObject;

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

  @belongsTo(() => Experience, {name: 'experience'}, {type: 'string'})
  onTimeline: string;

  @hasMany(() => Currency, {through: {model: () => UserCurrency}})
  currencies: Currency[];

  @hasMany(() => UserCurrency)
  userCurrencies: UserCurrency[];

  @hasMany(() => Post, {keyTo: 'createdBy'})
  posts: Post[];

  constructor(data?: Partial<User>) {
    super(data);
  }
}

export interface UserRelations {
  // describe navigational properties here
  experience?: ExperienceWithRelations;
  wallets?: WalletWithRelations;
}

export interface AdditionalProps {
  friendInfo?: AnyObject;
}

export type UserWithRelations = User & UserRelations & AdditionalProps;

export class UpdateUserDto extends Model {
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
    required: false,
  })
  profilePictureURL?: string;

  @property({
    type: 'string',
    required: false,
    default:
      'https://res.cloudinary.com/dsget80gs/background/profile-default-bg.png',
  })
  bannerImageURL?: string;

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
    type: 'date',
    required: false,
  })
  updatedAt?: string;
}
