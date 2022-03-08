import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    mongodb: {
      collection: 'experiencePosts',
    },
    indexes: {
      uniqueExperiencePostIndex: {
        keys: {
          experienceId: 1,
          postId: 1,
        },
        options: {
          unique: true,
        },
      },
    },
  },
})
export class ExperiencePost extends Entity {
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
    required: false,
  })
  experienceId: string;

  @property({
    type: 'string',
    required: false,
  })
  postId: string;

  constructor(data?: Partial<ExperiencePost>) {
    super(data);
  }
}

export interface ExperiencePostRelations {
  // describe navigational properties here
}

export type ExperiencePostWithRelations = ExperiencePost &
  ExperiencePostRelations;
