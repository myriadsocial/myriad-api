import {Entity, hasMany, model, property} from '@loopback/repository';
import {Comment} from './comment.model';
import {Conversation} from './conversation.model';
import {TransactionHistory} from './transaction-history.model';
import {Experience} from './experience.model';
import {Friend} from './friend.model';
import {Like} from './like.model';
import {Post} from './post.model';
import {SavedExperience} from './saved-experience.model';
import {Cryptocurrency} from './cryptocurrency.model';
import {UserCredential} from './user-credential.model';
import {UserCrypto} from './user-crypto.model';

@model({
  settings: {
    mongodb: {
      collection: 'users',
    },
    hiddenProperties: ['seed_example']
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
    required: true,
    jsonSchema: {
      minLength: 3,
    },
  })
  name: string;

  @property({
    type: 'string',
    required: false
  })
  username?: string

  @property({
    type: 'string',
    required: false,
    default: ''
  })
  profile_picture_url?: string;

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
  fcm_tokens?: string[]

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
  created_at?: string;

  @property({
    type: 'date',
    required: false,
  })
  updated_at?: string;

  @property({
    type: 'date',
    required: false,
  })
  deleted_at?: string;

  @hasMany(() => Experience, {keyTo: 'user_id'})
  experiences: Experience[];

  @hasMany(() => Comment, {keyTo: 'user_id'})
  comments: Comment[];

  @hasMany(() => Experience, {
    through: {
      model: () => SavedExperience, 
      keyFrom: 'user_id', 
      keyTo: 'experience_id'
    }
  })
  savedExperiences: Experience[];

  @hasMany(() => UserCredential, {keyTo: 'user_id'})
  credentials: UserCredential[];

  @hasMany(() => Post, {keyTo: 'walletAddress'})
  posts: Post[];

  @hasMany(() => Like, {keyTo: 'user_id'})
  likes: Like[];

  @hasMany(() => Conversation, {keyTo: 'user_id'})
  conversations: Conversation[];

  @hasMany(() => User, {
    through: {
      model: () => Friend,
      keyFrom: 'requestor_id',
      keyTo: 'friend_id'
    }
  })
  friends: User[];

  @hasMany(() => TransactionHistory, {keyTo: 'user_id'})
  transactionHistories: TransactionHistory[];

  @hasMany(() => Cryptocurrency, {
    through: {
      model: () => UserCrypto,
      keyFrom: 'user_id',
      keyTo: 'cryptocurrency_id'
    }
  })
  cryptocurrencies: Cryptocurrency[];

  constructor(data?: Partial<User>) {
    super(data);
  }
}

export interface UserRelations {
  // describe navigational properties here
  friends: User[];
}

export type UserWithRelations = User & UserRelations;
