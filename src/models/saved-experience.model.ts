import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    mongodb: {
      collection: "savedExperiences"
    }
  }
})
export class SavedExperience extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId'
    }
  })
  id: string;

  @property({
    type: 'string',
    required: true,
  })
  user_id: string;

  @property({
    type: 'string',
    required: true,
  })
  experience_id: string;


  constructor(data?: Partial<SavedExperience>) {
    super(data);
  }
}

export interface SavedExperienceRelations {
  // describe navigational properties here
}

export type SavedExperienceWithRelations = SavedExperience & SavedExperienceRelations;
