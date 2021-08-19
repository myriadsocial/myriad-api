import {Model, model, property} from '@loopback/repository';
import {PlatformType} from '../enums';

@model()
export class UserVerification extends Model {
  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      maxLength: 66,
      minLength: 66,
      pattern: '^0x',
    },
  })
  publicKey: string;

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
