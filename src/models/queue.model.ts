import {Entity, model, property} from '@loopback/repository';

@model()
export class Queue extends Entity {
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
