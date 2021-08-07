import {Entity, model, property} from '@loopback/repository';
import {PlatformType} from '../enums';

@model()
export class VerifyUser extends Entity {
  @property({
    type: 'string',
    required: true,
  })
  publickey: string;

  @property({
    type: 'string',
    required: true,
  })
  username: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: Object.values(PlatformType),
    },
  })
  platform: PlatformType;
}
