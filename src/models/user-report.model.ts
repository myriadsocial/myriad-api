import {belongsTo, Entity, model, property} from '@loopback/repository';
import {ReferenceType} from '../enums';
import {Report} from './report.model';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'userReports',
    },
    indexes: {
      reportedByIndex: {
        keys: {
          reportedBy: 1,
        },
      },
      reportIdIndex: {
        keys: {
          reportId: 1,
        },
      },
    },
  },
})
export class UserReport extends Entity {
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
  })
  description: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: Object.values(ReferenceType),
    },
  })
  referenceType: ReferenceType;

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

  @belongsTo(() => User, {name: 'reporter'})
  reportedBy: string;

  @belongsTo(() => Report)
  reportId: string;

  constructor(data?: Partial<UserReport>) {
    super(data);
  }
}

export interface UserReportRelations {
  // describe navigational properties here
}

export type UserReportWithRelations = UserReport & UserReportRelations;
