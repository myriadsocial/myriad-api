import {AnyObject, Model, model, property} from '@loopback/repository';

@model()
export class RequestLoginByOTP extends Model {
  @property({
    type: 'string',
    required: true,
  })
  token: string;

  @property({
    type: 'object',
    required: false,
  })
  data: AnyObject;

  constructor(data?: Partial<RequestLoginByOTP>) {
    super(data);
  }
}

export interface RequestLoginByOTPRelations {
  // describe navigational properties here
}

export type RequestLoginByOTPWithRelations = RequestLoginByOTP &
  RequestLoginByOTPRelations;
