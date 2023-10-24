import {AnyObject, Model, model, property} from '@loopback/repository';

@model()
export class RequestLoginByPAT extends Model {
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

  constructor(data?: Partial<RequestLoginByPAT>) {
    super(data);
  }
}

export interface RequestLoginByPATRelations {
  // describe navigational properties here
}

export type RequestLoginByPATWithRelations = RequestLoginByPAT &
  RequestLoginByPATRelations;
