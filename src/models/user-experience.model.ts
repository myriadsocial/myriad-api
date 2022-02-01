import {belongsTo, Entity, model, property} from '@loopback/repository';
import {Experience, ExperienceWithRelations} from './experience.model';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'userExperiences',
    },
    indexes: {
      userIdIndex: {
        keys: {
          userId: 1,
        },
      },
      experienceIdIndex: {
        keys: {
          experienceId: 1,
        },
      },
      uniqueUserExperienceIndex: {
        keys: {
          userId: 1,
          experienceId: 1,
        },
        options: {
          unique: true,
        },
      },
    },
    hiddenProperties: ['clonedId'],
  },
})
export class UserExperience extends Entity {
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
    type: 'boolean',
    default: false,
  })
  subscribed: boolean;

  @property({
    type: 'string',
    required: false,
  })
  clonedId?: string;

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

  @belongsTo(() => Experience, {}, {required: true})
  experienceId: string;

  @belongsTo(() => User, {}, {required: true})
  userId: string;

  constructor(data?: Partial<UserExperience>) {
    super(data);
  }
}

export interface UserExperienceRelations {
  // describe navigational properties here
  experience?: ExperienceWithRelations;
}

export type UserExperienceWithRelations = UserExperience &
  UserExperienceRelations;
