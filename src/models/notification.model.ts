import {belongsTo, Entity, model, property} from '@loopback/repository';
import {NotificationType} from '../enums';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'notifications',
    },
  },
})
export class Notification extends Entity {
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
      enum: Object.values(NotificationType),
    },
  })
  type: NotificationType;

  @belongsTo(() => User, {name: 'fromUserId'})
  from: string;

  @belongsTo(() => User, {name: 'toUserId'})
  to: string;

  @property({
    type: 'string',
    required: false,
  })
  referenceId?: string;

  @property({
    type: 'string',
    required: true,
  })
  message: string;

  @property({
    type: 'date',
    required: false,
  })
  createdAt?: string;

  @property({
    type: 'date',
    required: false,
  })
  updatedAt?: string;

  @property({
    type: 'date',
    required: false,
  })
  deletedAt?: string;

  constructor(data?: Partial<Notification>) {
    super(data);
  }
}

export interface NotificationRelations {
  // describe navigational properties here
}

export type NotificationWithRelations = Notification & NotificationRelations;
