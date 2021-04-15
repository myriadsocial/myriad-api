import {Entity, model, property} from '@loopback/repository';

@model()
export class VerifyUser extends Entity {
  @property({
    type: 'string',
    required: true,
  })
  userId: string;

  @property({
    type: 'string',
    required: true,
  })
  peopleId: string;


  constructor(data?: Partial<VerifyUser>) {
    super(data);
  }
}

export interface VerifyUserRelations {
  // describe navigational properties here
}

export type VerifyUserWithRelations = VerifyUser & VerifyUserRelations;
