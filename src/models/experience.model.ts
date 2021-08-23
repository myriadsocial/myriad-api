import {belongsTo, Entity, model, property} from '@loopback/repository';
import {ExperiencePeople, ExperienceTag} from '../interfaces';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'experiences',
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
    itemType: 'object',
    required: false,
  })
  tags: ExperienceTag[];

  @property({
    type: 'array',
    itemType: 'object',
    required: false,
  })
  people: ExperiencePeople[];

  @property({
    type: 'string',
    required: false,
    jsonSchema: {
      maxLength: 280,
    },
  })
  description: string;

  @property({
    type: 'number',
    default: 0,
  })
  cloned: number;

  @property({
    type: 'string',
    default: null,
  })
  clonedFrom?: string | null;

  @property({
    type: 'boolean',
    default: true,
  })
  origin: boolean;

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

  @belongsTo(
    () => User,
    {name: 'user'},
    {
      jsonSchema: {
        maxLength: 66,
        minLength: 66,
        pattern: '^0x',
      },
      required: true,
    },
  )
  createdBy: string;

  constructor(data?: Partial<Experience>) {
    super(data);
  }
}

export interface ExperienceRelations {
  // describe navigational properties here
}

export type ExperienceWithRelations = Experience & ExperienceRelations;
