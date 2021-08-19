import {belongsTo, Entity, model, property} from '@loopback/repository';
import {StatusType} from '../enums';
import {Experience, ExperienceWithRelations} from './experience.model';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'userExperiences',
    },
  },
  jsonSchema: {
    required: ['userId', 'experienceId'],
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
    type: 'string',
    default: null,
  })
  clonedFrom?: string | null;

  @property({
    type: 'string',
    default: StatusType.NONE,
    jsonSchema: {
      enum: Object.values(StatusType),
    },
  })
  status?: StatusType;

  @property({
    type: 'date',
    default: false,
  })
  createdAt: string;

  @property({
    type: 'date',
    default: false,
  })
  updatedAt: string;

  @property({
    type: 'date',
    default: false,
  })
  deletedAt: string;

  @belongsTo(() => Experience)
  experienceId: string;

  @belongsTo(
    () => User,
    {},
    {
      jsonSchema: {
        maxLength: 66,
        minLength: 66,
        pattern: '^0x',
      },
      required: true,
    },
  )
  userId: string;

  constructor(data?: Partial<UserExperience>) {
    super(data);
  }
}

export interface UserExperienceRelations {
  // describe navigational properties here
  experience: ExperienceWithRelations;
}

export type UserExperienceWithRelations = UserExperience & UserExperienceRelations;
