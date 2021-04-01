import {belongsTo, Entity, model, property, hasMany} from '@loopback/repository';
import {User} from './user.model';
import {SavedExperience} from './saved-experience.model';
import {Tag} from './tag.model';

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

  @belongsTo(() => User)
  userId: string;

  @hasMany(() => User, {through: {model: () => SavedExperience, keyFrom: 'experience_id', keyTo: 'user_id'}})
  savedUsers: User[];
  
  constructor(data?: Partial<Experience>) {
    super(data);
  }
}

export interface ExperienceRelations {
  // describe navigational properties here
}

export type ExperienceWithRelations = Experience & ExperienceRelations;
