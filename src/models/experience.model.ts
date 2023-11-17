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
import {ExperienceEditor} from './experience-editor.model';
import {UserWithRelations} from './user.model';
import {Post} from './post.model';
import {ExperiencePost} from './experience-post.model';
import {VisibilityType} from '../enums';

export interface SelectedUser {
  userId: string;
  addedAt: number;
}

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
  id: string;

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
    required: false,
    default: [],
  })
  allowedTags: string[];

  @property({
    type: 'array',
    itemType: 'string',
    required: false,
    default: [],
  })
  prohibitedTags: string[];

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
    type: 'number',
    default: 0,
  })
  clonedCount: number;

  @property({
    type: 'number',
    default: 0,
  })
  trendCount: number;

  @property({
    type: 'string',
    required: false,
    default: VisibilityType.PUBLIC,
    jsonSchema: {
      enum: Object.values(VisibilityType),
    },
  })
  visibility: VisibilityType;

  @property({
    type: 'array',
    itemType: 'object',
    default: [],
  })
  selectedUserIds: SelectedUser[];

  @property({
    type: 'date',
    required: false,
    default: () => new Date(),
  })
  createdAt: string;

  @property({
    type: 'date',
    required: false,
    default: () => new Date(),
  })
  updatedAt: string;

  @property({
    type: 'date',
    required: false,
  })
  deletedAt?: string;

  @belongsTo(() => User, {name: 'user'}, {required: true})
  createdBy: string;

  @hasMany(() => Post, {through: {model: () => ExperiencePost}})
  posts: Post[];

  @hasMany(() => User, {through: {model: () => ExperienceUser}})
  users?: User[];

  @hasMany(() => User, {through: {model: () => ExperienceEditor}})
  editors?: User[];

  constructor(data?: Partial<Experience>) {
    super(data);
  }
}

export interface ExperienceRelations {
  // describe navigational properties here
  user?: UserWithRelations;
}

export type ExperienceWithRelations = Experience & ExperienceRelations;

export class createExperienceDto extends Experience {
  editorsId?: string[];
}
