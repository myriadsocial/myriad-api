import {AnyObject, Model, model, property} from '@loopback/repository';

@model()
export class RequestLoginByEmail extends Model {
  @property({
    type: 'string',
    required: true,
  })
  otwp: string;

  @property({
    type: 'object',
    required: false,
  })
  data: AnyObject;

  constructor(data?: Partial<RequestLoginByEmail>) {
    super(data);
  }
}

export interface RequestLoginByEmailRelations {
  // describe navigational properties here
}

export type RequestLoginByEmailWithRelations = RequestLoginByEmail &
  RequestLoginByEmailRelations;
