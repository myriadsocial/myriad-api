import {
  AnyObject,
  Entity,
  hasMany,
  Model,
  model,
  property,
} from '@loopback/repository';
import {ReferenceType, ReportStatusType, ReportType} from '../enums';
import {UserReport} from './user-report.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'reports',
    },
  },
})
export class Report extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id?: string;

  @property({
    type: 'object',
    required: false,
  })
  reportedDetail: AnyObject;

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
    required: false,
    jsonSchema: {
      enum: Object.values(ReportType),
    },
  })
  type: ReportType;

  @property({
    type: 'string',
    required: true,
  })
  referenceId: string;

  @property({
    type: 'string',
    required: false,
    default: ReportStatusType.PENDING,
    jsonSchema: {
      enum: Object.values(ReportStatusType),
    },
  })
  status: ReportStatusType;

  @property({
    type: 'number',
    required: false,
  })
  totalReported?: number;

  @property({
    type: 'date',
    required: false,
    default: () => new Date(),
  })
  createdAt?: string;

  @property({
    type: 'date',
    required: false,
    default: () => new Date(),
  })
  updatedAt?: string;

  @property({
    type: 'date',
    required: false,
  })
  deletedAt?: string;

  @hasMany(() => UserReport)
  reporters: UserReport[];

  constructor(data?: Partial<Report>) {
    super(data);
  }
}

export interface ReportRelations {
  // describe navigational properties here
}

export type ReportWithRelations = Report & ReportRelations;

@model()
export class CreateReportDto extends Model {
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
    jsonSchema: {
      enum: Object.values(ReportType),
    },
  })
  type: ReportType;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      minLength: 3,
    },
  })
  description: string;

  constructor(data?: Partial<CreateReportDto>) {
    super(data);
  }
}
