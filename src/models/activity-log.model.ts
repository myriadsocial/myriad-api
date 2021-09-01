import {belongsTo, Entity, model, property} from '@loopback/repository';
import {ActivityLogType} from '../enums';
import {User} from './user.model';

@model({
  settings: {
    mongodb: {
      collection: 'activities',
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
    required: true,
  })
  message: string;

  @belongsTo(
    () => User,
    {},
    {
      required: true,
      jsonSchema: {
        maxLength: 66,
        minLength: 66,
        pattern: '^0x',
      },
    },
  )
  userId: string;

  constructor(data?: Partial<ActivityLog>) {
    super(data);
  }
}

export interface ActivityLogRelations {
  // describe navigational properties here
}

export type ActivityLogWithRelations = ActivityLog & ActivityLogRelations;
