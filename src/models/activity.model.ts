import {belongsTo, Entity, model, property} from '@loopback/repository';
import {LogType} from '../enums';
import {User} from './user.model';

@model({
  settings: {
    mongodb: {
      collection: 'activities',
    },
  },
})
export class Activity extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: Object.values(LogType),
    },
  })
  type: LogType;

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

  constructor(data?: Partial<Activity>) {
    super(data);
  }
}

export interface ActivityRelations {
  // describe navigational properties here
}

export type ActivityWithRelations = Activity & ActivityRelations;
