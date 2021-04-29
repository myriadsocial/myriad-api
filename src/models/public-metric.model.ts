import {Entity, model, property, belongsTo} from '@loopback/repository';
import {Post} from './post.model';

@model({
  mongodb: {
    collection: "public_metrics"
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
    required: true,
  })
  liked: number;

  @property({
    type: 'number',
    required: true,
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
