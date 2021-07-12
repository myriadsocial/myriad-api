import {Entity, hasMany, hasOne, model, property} from '@loopback/repository';
import {Post} from './post.model';
import {UserCredential} from './user-credential.model';
import {Tip, TipWithRelations} from './tip.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'people'
    }
  }
})
export class People extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId'
    }
  })
  id?: string;

  @property({
    type: 'string',
    required: false
  })
  name?: string

  @property({
    type: 'string',
    required: true,
  })
  username: string;

  @property({
    type: 'string',
    required: false,
  })
  platform: string;

  @property({
    type: 'string',
    required: false,
  })
  platform_account_id: string;

  @property({
    type: 'string',
    required: false
  })
  profile_image_url: string;

  @property({
    type: 'boolean',
    default: false
  })
  hide?: boolean
  
  @hasOne(() => UserCredential, {keyTo: 'people_id'})
  credential: UserCredential;

  @hasMany(() => Post, {keyTo: 'people_id'})
  posts: Post[];

  @hasMany(() => Tip, {keyTo: 'people_id'})
  tips: Tip[];

  constructor(data?: Partial<People>) {
    super(data);
  }
}

export interface PeopleRelations {
  // describe navigational properties here
}

export type PeopleWithRelations = People & PeopleRelations;
