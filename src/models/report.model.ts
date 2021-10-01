import {Entity, model, property, belongsTo} from '@loopback/repository';
import {ReportStatusType} from '../enums/report-status-type.enum';
import {ReportType} from '../enums/report-type.enum';
import {User} from './user.model';
import {ReferenceType} from '../enums';
import {Post} from './post.model';
import {PostWithRelations, UserWithRelations} from '.';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'reports',
    },
    hiddenProperties: ['postId', 'userId'],
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
    required: true,
    default: true,
    jsonSchema: {
      enum: Object.values(ReportType),
    },
  })
  type: ReportType;

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
    type: 'string',
    required: true,
    jsonSchema: {
      minLength: 3,
    },
  })
  reason: string;

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

  @belongsTo(
    () => User,
    {name: 'reporter'},
    {
      required: true,
      jsonSchema: {
        maxLength: 66,
        minLength: 66,
        pattern: '^0x',
      },
    },
  )
  reportedBy: string;

  @belongsTo(() => Post)
  postId: string;

  @belongsTo(() => User)
  userId: string;

  constructor(data?: Partial<Report>) {
    super(data);
  }
}

export interface ReportRelations {
  // describe navigational properties here
  user?: UserWithRelations;
  post?: PostWithRelations;
}

export type ReportWithRelations = Report & ReportRelations;
