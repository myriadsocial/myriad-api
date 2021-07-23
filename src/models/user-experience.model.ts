import {belongsTo, Entity, model, property} from '@loopback/repository';
import {Experience} from './experience.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'userExperiences',
    },
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
    required: true,
  })
  userId: string;

  @property({
    type: 'boolean',
    default: true
  })
  hasSelected: boolean;

  @belongsTo(() => Experience)
  experienceId: string;

  constructor(data?: Partial<UserExperience>) {
    super(data);
  }
}

export interface UserExperienceRelations {
  // describe navigational properties here
}

export type UserExperienceWithRelations = UserExperience &
  UserExperienceRelations;
