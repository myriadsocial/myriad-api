import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'ExperienceEditors',
    },
    indexes: {
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
  },
})
export class ExperienceEditor extends Entity {
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
  userId: string;

  constructor(data?: Partial<ExperienceEditor>) {
    super(data);
  }
}

export interface ExperienceEditorRelations {
  // describe navigational properties here
}

export type ExperienceEditorWithRelations = ExperienceEditor &
  ExperienceEditorRelations;
