import {Entity, model, property, hasMany} from '@loopback/repository';
// import {Experience} from './experience.model';
// import {SavedTag} from './saved-tag.model';

@model({
  settings: {
    mongodb: {
      collection: 'tags',
    },
  }
})
export class Tag extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: false,
    required: true,
    jsonSchema: {
      maxLength: 50,
      minLength: 1,
    },
  })
  id: string;

  @property({
    type: 'boolean',
    default: false
  })

  hide: boolean;

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

  // @hasMany(() => Experience, {through: {model: () => SavedTag, keyFrom: 'tag_id', keyTo: 'experience_id'}})
  // savedExperiences: Experience[];

  constructor(data?: Partial<Tag>) {
    super(data);
  }
}

export interface TagRelations {
  // describe navigational properties here
}

export type TagWithRelations = Tag & TagRelations;
