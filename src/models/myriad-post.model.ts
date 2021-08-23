import {Model, model, property} from '@loopback/repository';
import {PlatformType} from '../enums';
import {Asset} from '../interfaces/asset.interface';

@model()
export class MyriadPost extends Model {
  @property({
    type: 'array',
    itemType: 'string',
    required: false,
    default: [],
  })
  tags: string[];

  @property({
    type: 'string',
    required: true,
  })
  text: string;

  @property({
    type: 'object',
    required: false,
    default: {
      videos: [],
      images: [],
    },
  })
  asset?: Asset;

  @property({
    jsonSchema: {
      maxLength: 66,
      minLength: 66,
      pattern: '^0x',
    },
    required: true,
  })
  createdBy: string;

  platform = PlatformType.MYRIAD;

  constructor(data?: Partial<MyriadPost>) {
    super(data);
  }
}
