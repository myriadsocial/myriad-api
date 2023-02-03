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
    generated: false,
    required: false,
    default: 0,
  })
  id: number;

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
      totalComments: 0,
      totalUsers: 0,
      totalVotes: 0,
      totalTransactions: 0,
      totalExperiences: 0,
      totalSubscriptions: 0,
      totalConnectedSocials: {
        totalReddit: 0,
        totalTwitter: 0,
        totalMyriad: 0,
      },
      totalPosts: {
        totalMyriad: 0,
        totalTwitter: 0,
        totalReddit: 0,
        totalAll: 0,
      },
    },
  })
  metric: ServerMetric;

  @property({
    type: 'object',
    required: false,
  })
  median?: AnyObject;

  @property({
    type: 'object',
    required: false,
  })
  average?: AnyObject;

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

  constructor(data?: Partial<Server>) {
    super(data);
  }
}

export interface ServerRelations {
  // describe navigational properties here
}

export type ServerWithRelations = Server & ServerRelations;
