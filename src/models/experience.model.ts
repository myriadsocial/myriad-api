import {
  belongsTo,
  Entity,
  model,
  property,
  hasMany,
} from '@loopback/repository';
import {People} from './people.model';
import {User} from './user.model';
import {ExperienceUser} from './experience-user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'experiences',
    },
    indexes: {
      createdByIndex: {
        keys: {
          createdBy: 1,
        },
      },
    },
  },
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
    type: 'array',
    itemType: 'string',
    required: true,
  })
  tags: string[];

  @property({
    type: 'array',
    itemType: 'object',
    required: false,
  })
  people: People[];

  @property({
    type: 'string',
    required: false,
    jsonSchema: {
      maxLength: 280,
    },
  })
  description: string;

  @property({
    type: 'string',
    required: false,
    default: '',
  })
  experienceImageURL?: string;

  @property({
    type: 'number',
    default: 0,
  })
  subscribedCount: number;

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

  @belongsTo(() => User, {name: 'user'})
  createdBy: string;

  @hasMany(() => User, {through: {model: () => ExperienceUser}})
  users: User[];

  constructor(data?: Partial<Experience>) {
    super(data);
  }
}

export interface ExperienceRelations {
  // describe navigational properties here
}

export type ExperienceWithRelations = Experience & ExperienceRelations;
