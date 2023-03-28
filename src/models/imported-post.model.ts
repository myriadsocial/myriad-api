import {Entity, Model, property} from '@loopback/repository';
import {Asset} from '../interfaces';
import {User} from './user.model';

export class ImportedPost extends Entity {
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
    jsonSchema: {
      properties: {},
    },
  })
  asset?: Asset;

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

  constructor(data?: Partial<ImportedPost>) {
    super(data);
  }
}

export class CreateImportedPostDto extends Model {
  @property({
    type: 'string',
    required: true,
  })
  url: string;

  @property({
    type: 'string',
    required: true,
  })
  importer: string;

  @property({
    type: 'array',
    itemType: 'string',
    required: false,
  })
  tags?: string[];

  @property({
    type: 'array',
    itemType: 'string',
    required: true,
    default: [],
  })
  selectedTimelineIds: string[];

  @property({
    type: 'string',
    require: false,
  })
  NSFWTag?: string;

  constructor(data?: Partial<CreateImportedPostDto>) {
    super(data);
  }
}
