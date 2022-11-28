import {Entity, property} from '@loopback/repository';
import {Asset} from '../interfaces';
import {User} from './user.model';

export class ImportPost extends Entity {
  @property({
    type: 'string',
    required: false,
  })
  title?: string;

  @property({
    type: 'string',
    required: false,
  })
  originPostId?: string;

  @property({
    type: 'string',
    required: false,
  })
  url?: string;

  @property({
    type: 'object',
    required: false,
  })
  asset?: Asset;

  @property({
    type: 'date',
    required: false,
    default: () => new Date(),
  })
  originCreatedAt?: string;

  @property({
    type: 'array',
    itemType: 'object',
    required: false,
  })
  importers?: User[];

  @property({
    type: 'number',
    required: false,
  })
  totalImporter?: number;

  constructor(data?: Partial<ImportPost>) {
    super(data);
  }
}
