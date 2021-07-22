import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'savedExperiences',
    },
  },
})
export class SavedExperience extends Entity {
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
    type: 'string',
    required: true,
  })
  experienceId: string;

  @property({
    type: 'boolean',
    default: true
  })
  hasSelected: boolean;

  constructor(data?: Partial<SavedExperience>) {
    super(data);
  }
}

export interface SavedExperienceRelations {
  // describe navigational properties here
}

export type SavedExperienceWithRelations = SavedExperience &
  SavedExperienceRelations;
