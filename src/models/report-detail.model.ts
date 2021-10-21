import {Model, model, property} from '@loopback/repository';
import {ReferenceType} from '../enums';

@model()
export class ReportDetail extends Model {
  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: Object.values(ReferenceType),
    },
  })
  referenceType: ReferenceType;

  @property({
    type: 'string',
    required: true,
  })
  referenceId: string;

  @property({
    type: 'string',
    required: false,
  })
  type: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      minLength: 3,
    },
  })
  description: string;

  constructor(data?: Partial<ReportDetail>) {
    super(data);
  }
}

export interface ReportDetailRelations {
  // describe navigational properties here
}

export type ReportDetailWithRelations = ReportDetail & ReportDetailRelations;
