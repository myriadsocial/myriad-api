import {AnyObject, Entity, model, property} from '@loopback/repository';
import {ServerMetric} from '../interfaces';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'servers',
    },
  },
})
export class Server extends Entity {
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
  })
  name: string;

  @property({
    type: 'string',
    required: false,
  })
  serverImageURL: string;

  @property({
    type: 'string',
    required: false,
    default:
      'A decentralized (web3+federated) metasocial network on top of your mainstream social media.',
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

  @property({
    type: 'object',
    required: true,
    default: {},
  })
  accountId: AnyObject;

  @property({
    type: 'object',
    required: false,
    default: {},
  })
  images?: AnyObject;

  constructor(data?: Partial<Server>) {
    super(data);
  }
}

export interface ServerRelations {
  // describe navigational properties here
}

export type ServerWithRelations = Server & ServerRelations;
