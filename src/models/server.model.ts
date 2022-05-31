import {Entity, model, property} from '@loopback/repository';
import {ServerMetric} from '../interfaces';

@model({
  settings: {
    mongodb: {
      collection: 'servers',
    },
  },
})
export class Server extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: false,
    required: true,
  })
  id: string;

  @property({
    type: 'string',
    required: true,
  })
  name: string;

  @property({
    type: 'string',
    required: false,
    default: 'Welcome to myriad social!',
  })
  description: string;

  @property({
    type: 'object',
    required: false,
    default: {
      totalPosts: 0,
      totalUsers: 0,
      totalVotes: 0,
      totalTransactions: 0,
      totalExperiences: 0,
    },
  })
  metric: ServerMetric;

  @property({
    type: 'array',
    itemType: 'string',
    required: false,
    default: ['myriad'],
  })
  categories: string[];

  constructor(data?: Partial<Server>) {
    super(data);
  }
}

export interface ServerRelations {
  // describe navigational properties here
}

export type ServerWithRelations = Server & ServerRelations;
