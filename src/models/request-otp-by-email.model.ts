import {Model, model, property} from '@loopback/repository';

@model()
export class RequestOTPByEmail extends Model {
  @property({
    type: 'string',
    required: true,
  })
  email: string;

  constructor(data?: Partial<RequestOTPByEmail>) {
    super(data);
  }
}

export interface RequestOTPByEmailRelations {
  // describe navigational properties here
}

export type RequestOTPByEmailithRelations = RequestOTPByEmail &
  RequestOTPByEmailRelations;
