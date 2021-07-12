import {belongsTo, Entity, hasMany, model, property} from '@loopback/repository';
import {SavedExperience} from './saved-experience.model';
import {User} from './user.model';

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
    index: {
      unique: true,
    },
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
    type: 'string',
    required: false,
    default: ''
  })
  layout: string

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

  @belongsTo(() => User, {name: 'user'})
  user_id: string;

  @hasMany(() => User, {
    through: {
      model: () => SavedExperience, 
      keyFrom: 'experience_id', 
      keyTo: 'user_id'
    }
  })
  users: User[];

  constructor(data?: Partial<Experience>) {
    super(data);
  }
}

export interface ExperienceRelations {
  // describe navigational properties here
}

export type ExperienceWithRelations = Experience & ExperienceRelations;
