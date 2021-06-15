import {Entity, hasMany, model, property} from '@loopback/repository';
import {Comment} from './comment.model';
import {Conversation} from './conversation.model';
import {DetailTransaction} from './detail-transaction.model';
import {Experience} from './experience.model';
import {Friend} from './friend.model';
import {Like} from './like.model';
import {Post} from './post.model';
import {SavedExperience} from './saved-experience.model';
import {Token} from './token.model';
import {UserCredential} from './user-credential.model';
import {UserToken} from './user-token.model';

@model({
  settings: {
    mongodb: {
      collection: 'users',
    },
    hiddenProperties: ['seed_example', 'name', 'username']
  }
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
    required: false,
    // jsonSchema: {
    //   maxLength: 30,
    //   minLength: 3,
    // },
  })
  name?: string;

  @property({
    type: 'string',
    required: false,
    // index: {
    //   unique: true
    // },
    // jsonSchema: {
    //   minLength: 6,
    //   maxLength: 30
    // }
  })
  username?: string

  @property({
    type: 'string',
    required: false,
    default: ''
  })
  profilePictureURL?: string;

  @property({
    type: 'boolean',
    required: false,
    default: false,
  })
  anonymous?: boolean;

  @property({
    type: 'string',
    required: false
  })
  bio?: string;

  @property({
    type: 'array',
    itemType: 'string',
    required: false,
    default: []
  })
  fcm_token?: string[]

  @property({
    type: 'boolean',
    required: false,
    default: false,
  })
  skip_tour: boolean

  @property({
    type: 'string',
    required: false,
  })
  seed_example?: string

  @property({
    type: 'array',
    itemType: 'string',
    required: false
  })
  fcmTokens?: string[]

  @property({
    type: 'boolean',
    required: false,
    default: true
  })
  is_online?: boolean

  @property({
    type: 'date',
    required: false,
  })
  createdAt?: string;

  @property({
    type: 'date',
    required: false,
  })
  updatedAt?: string;

  @property({
    type: 'date',
    required: false,
  })
  deletedAt?: string;

  @hasMany(() => Experience)
  experiences: Experience[];

  @hasMany(() => Comment)
  comments: Comment[];

  @hasMany(() => Experience, {through: {model: () => SavedExperience, keyFrom: 'user_id', keyTo: 'experience_id'}})
  savedExperiences: Experience[];

  @hasMany(() => UserCredential)
  userCredentials: UserCredential[];

  @hasMany(() => Post, {keyTo: 'walletAddress'})
  posts: Post[];

  @hasMany(() => Like)
  likes: Like[];

  @hasMany(() => Conversation)
  conversations: Conversation[];

  @hasMany(() => User, {
    through: {
      model: () => Friend,
      keyFrom: 'requestorId',
      keyTo: 'friendId'
    }
  })
  friends: User[];

  @hasMany(() => DetailTransaction)
  detailTransactions: DetailTransaction[];

  @hasMany(() => Token, {through: {model: () => UserToken}})
  tokens: Token[];

  constructor(data?: Partial<User>) {
    super(data);
  }
}

export interface UserRelations {
  // describe navigational properties here
}

export type UserWithRelations = User & UserRelations;
