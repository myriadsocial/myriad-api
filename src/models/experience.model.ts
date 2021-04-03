import {belongsTo, Entity, model, property, hasMany} from '@loopback/repository';
import {User} from './user.model';
import {SavedExperience} from './saved-experience.model';
import {Tag} from './tag.model';
import {SavedTag} from './saved-tag.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'experiences',
    },
  }
})
export class Experience extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id?: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      maxLength: 50,
      minLength: 1,
    },
  })
  name: string;

  @property({
    type: "array",
    itemType: "object",
    required: false,
  })

  tags: object[]

  @property({
    type: "array",
    itemType: "object",
    required: false
  })

  people: object[]

  @property({
    type: 'date',
    required: true,
  })
  createdAt: string;

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
  
  @property({
    type: 'boolean',
    default: false
  })
  default?: boolean

  @property({
    type: 'string',
    required: false,
  })
  description: string


  @belongsTo(() => User)
  userId: string;

  @hasMany(() => User, {through: {model: () => SavedExperience, keyFrom: 'experience_id', keyTo: 'user_id'}})
  savedUsers: User[];

  // @hasMany(() => Tag, {through: {model: () => SavedTag, keyFrom: 'experience_id', keyTo: 'tag_id'}})
  // savedTags: Tag[];

  constructor(data?: Partial<Experience>) {
    super(data);
  }
}

export interface ExperienceRelations {
  // describe navigational properties here
}

export type ExperienceWithRelations = Experience & ExperienceRelations;
