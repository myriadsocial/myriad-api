import {Model, model, property} from '@loopback/repository';

@model()
export class ChangeEmailRequest extends Model {
  @property({
    type: 'string',
    required: true,
  })
  email: string;

  constructor(data?: Partial<ChangeEmailRequest>) {
    super(data);
  }
}

export interface ChangeEmailRequestRelations {
  // describe navigational properties here
}

export type ChangeEmailRequestWithRelations = ChangeEmailRequest &
  ChangeEmailRequestRelations;
