import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'queues',
    },
  },
})
export class Queue extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: false,
    required: true,
  })
  id: string;

  @property({
    type: 'number',
    required: true,
  })
  priority: number;

  constructor(data?: Partial<Queue>) {
    super(data);
  }
}

export interface QueueRelations {
  // describe navigational properties here
}

export type QueueWithRelations = Queue & QueueRelations;
