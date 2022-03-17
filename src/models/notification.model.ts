import {
  AnyObject,
  belongsTo,
  Entity,
  model,
  property,
} from '@loopback/repository';
import {NotificationType} from '../enums';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'notifications',
    },
    indexes: {
      fromIndex: {
        keys: {
          from: 1,
        },
      },
      toIndex: {
        keys: {
          to: 1,
        },
      },
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

  @property({
    type: 'boolean',
    default: false,
  })
  read: boolean;

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
    type: 'object',
    required: false,
  })
  additionalReferenceId: AnyObject;

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

  @belongsTo(() => User, {name: 'fromUserId'}, {required: true})
  from: string;

  @belongsTo(() => User, {name: 'toUserId'}, {required: true})
  to: string;

  constructor(data?: Partial<Notification>) {
    super(data);
  }
}

export interface NotificationRelations {
  // describe navigational properties here
}

export type NotificationWithRelations = Notification & NotificationRelations;
