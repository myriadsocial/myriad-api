import {Model, model, property} from '@loopback/repository';

@model()
export class RequestOtpw extends Model {
  @property({
    type: 'string',
    required: true,
  })
  email: string;

  constructor(data?: Partial<RequestOtpw>) {
    super(data);
  }
}

export interface RequestOtpwRelations {
  // describe navigational properties here
}

export type RequestOtpwWithRelations = RequestOtpw & RequestOtpwRelations;
