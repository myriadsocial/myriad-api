import {Entity, hasMany, model, property} from '@loopback/repository';
import {Comment} from './comment.model';
import {Conversation} from './conversation.model';
import {Cryptocurrency} from './cryptocurrency.model';
import {Experience} from './experience.model';
import {Friend} from './friend.model';
import {Post} from './post.model';
import {TransactionHistory} from './transaction-history.model';
import {UserCredential} from './user-credential.model';
import {UserCryptocurrency} from './user-cryptocurrency.model';
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
  username?: string;

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
    type: 'boolean',
    default: false,
  })
  anonymous?: boolean;

  @property({
    type: 'string',
    required: false,
  })
  bio?: string;

  @property({
    type: 'boolean',
    default: false,
  })
  skipTour?: boolean;

  @property({
    type: 'array',
    itemType: 'string',
    required: false,
    default: [],
  })
  fcmTokens?: string[];

  @property({
    type: 'boolean',
    default: true,
  })
  isOnline?: boolean;

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

  @hasMany(() => Experience, {keyTo: 'creatorId'})
  experiences: Experience[];

  @hasMany(() => Comment)
  comments: Comment[];

  @hasMany(() => Experience, {
    through: {
      model: () => UserExperience,
      keyFrom: 'userId',
      keyTo: 'experienceId',
    },
  })
  userExperiences: Experience[];

  @hasMany(() => UserCredential)
  credentials: UserCredential[];

  @hasMany(() => Post, {keyTo: 'walletAddress'})
  posts: Post[];

  @hasMany(() => Conversation)
  conversations: Conversation[];

  @hasMany(() => User, {
    through: {
      model: () => Friend,
      keyFrom: 'requestorId',
      keyTo: 'friendId',
    },
  })
  friends: User[];

  @hasMany(() => TransactionHistory)
  transactionHistories: TransactionHistory[];

  @hasMany(() => Cryptocurrency, {
    through: {
      model: () => UserCryptocurrency,
      keyFrom: 'userId',
      keyTo: 'cryptocurrencyId',
    },
  })
  cryptocurrencies: Cryptocurrency[];

  constructor(data?: Partial<User>) {
    super(data);
  }
}

export interface UserRelations {
  // describe navigational properties here
}

export type UserWithRelations = User & UserRelations;
