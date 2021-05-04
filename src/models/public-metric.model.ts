import {Entity, model, property, belongsTo} from '@loopback/repository';
import {Post} from './post.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: "publicMetrics"
    }
  }
})
export class PublicMetric extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId'
    }
  })
  id?: string;

  @property({
    type: 'number',
    required: false,
    default: 0
  })
  liked: number;

  @property({
    type: 'number',
    required: false,
    default: 0
  })
  disliked: number;

  @property({
    type: 'number',
    required: false,
    default: 0
  })
  comment: number;

  @belongsTo(() => Post)
  postId: string;

  constructor(data?: Partial<PublicMetric>) {
    super(data);
  }
}

export interface PublicMetricRelations {
  // describe navigational properties here
}

export type PublicMetricWithRelations = PublicMetric & PublicMetricRelations;
