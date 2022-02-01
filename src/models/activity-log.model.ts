import {belongsTo, Entity, model, property} from '@loopback/repository';
import {ActivityLogType, ReferenceType} from '../enums';
import {User} from './user.model';

@model({
  settings: {
    mongodb: {
      collection: 'activityLogs',
    },
    indexes: {
      userIdIndex: {
        keys: {
          userId: 1,
        },
      },
    },
  },
})
export class ActivityLog extends Entity {
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
      enum: Object.values(ActivityLogType),
    },
  })
  type: ActivityLogType;

  @property({
    type: 'string',
    required: false,
  })
  referenceId?: string;

  @property({
    type: 'string',
    required: false,
    jsonSchema: {
      enum: Object.values(ReferenceType),
    },
  })
  referenceType?: ReferenceType;

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

  @belongsTo(() => User, {}, {required: true})
  userId: string;

  constructor(data?: Partial<ActivityLog>) {
    super(data);
  }
}

export interface ActivityLogRelations {
  // describe navigational properties here
}

export type ActivityLogWithRelations = ActivityLog & ActivityLogRelations;
