import {Entity, model, property, belongsTo} from '@loopback/repository';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'notificationSettings',
    },
    indexes: {
      uniqueUserIdIndex: {
        keys: {
          userId: 1,
        },
        options: {
          unique: true,
        },
      },
    },
  },
})
export class NotificationSetting extends Entity {
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
    type: 'boolean',
    default: true,
    required: false,
  })
  comments?: boolean;

  @property({
    type: 'boolean',
    default: true,
    required: false,
  })
  mentions?: boolean;

  @property({
    type: 'boolean',
    default: true,
    required: false,
  })
  friendRequests?: boolean;

  @property({
    type: 'boolean',
    default: true,
    required: false,
  })
  tips?: boolean;

  @belongsTo(() => User)
  userId: string;

  constructor(data?: Partial<NotificationSetting>) {
    super(data);
  }
}

export interface NotificationSettingRelations {
  // describe navigational properties here
}

export type NotificationSettingWithRelations = NotificationSetting &
  NotificationSettingRelations;
