import {
  Entity,
  model,
  property,
  belongsTo,
  hasMany,
} from '@loopback/repository';
import {ReportStatusType} from '../enums/report-status-type.enum';
import {User} from './user.model';
import {Post} from './post.model';
import {PostWithRelations, UserWithRelations} from '.';
import {UserReport} from './user-report.model';
import {ReferenceType} from '../enums';

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
    required: false,
  })
  type: string;

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

  @belongsTo(() => Post, {name: 'reportedPost'})
  postId: string;

  @belongsTo(() => User, {name: 'reportedUser'})
  userId: string;

  @hasMany(() => UserReport)
  reporters: UserReport[];

  constructor(data?: Partial<Report>) {
    super(data);
  }
}

export interface ReportRelations {
  // describe navigational properties here
  reportedUser?: UserWithRelations;
  reportedPost?: PostWithRelations;
}

export type ReportWithRelations = Report & ReportRelations;
