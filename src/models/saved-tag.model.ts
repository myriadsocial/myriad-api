import {Entity, model, property} from '@loopback/repository';

@model()
export class SavedTag extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id?: string;

  @property({
    type: 'string',
    required: true,
  })
  tag_id: string;

  @property({
    type: 'string',
    required: true,
  })
  experience_id: string;


  constructor(data?: Partial<SavedTag>) {
    super(data);
  }
}

export interface SavedTagRelations {
  // describe navigational properties here
}

export type SavedTagWithRelations = SavedTag & SavedTagRelations;
