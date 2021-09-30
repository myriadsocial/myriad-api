import {model, Model, property} from '@loopback/repository';

@model()
export class MentionUser extends Model {
  @property({
    type: 'string',
  })
  id: string;

  @property({
    type: 'string',
  })
  name: string;

  @property({
    type: 'string',
  })
  username: string;

  constructor(data?: Partial<MentionUser>) {
    super(data);
  }
}

export interface MentionUserRelations {
  // describe navigational properties here
}

export type MentionUserWithRelations = MentionUser & MentionUserRelations;
