import {Entity, property, model} from '@loopback/repository';
import {VisibilityType} from '../enums';
import {SelectedUser} from './experience.model';

export interface Timeline {
  timelineId: string;
  allowedTags: string[];
  prohibitedTags: string[];
  peopleIds: string[];
  userIds: string[];
  selectedUserIds: SelectedUser[];
  visibility: VisibilityType;
  createdBy: string;
  createdAt: number;
}

export interface ConfigData {
  [key: string]: Timeline;
}

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'timelineConfigs',
    },
  },
})
export class TimelineConfig extends Entity {
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
    type: 'object',
    required: false,
    default: {},
  })
  data: ConfigData;

  @property({
    type: 'string',
    required: true,
  })
  userId: string;

  constructor(data: Partial<TimelineConfig>) {
    super(data);
  }
}

export interface TimelineConfigRelations {
  // describe navigational properties here
}

export type TimelineConfigWithRelations = TimelineConfig &
  TimelineConfigRelations;
