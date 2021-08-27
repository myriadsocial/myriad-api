import {Model, model, property} from '@loopback/repository';

@model()
export class Media extends Model {
  @property({
    type: 'string',
  })
  url?: string;

  @property({
    type: 'number',
  })
  width?: number;

  @property({
    type: 'number',
  })
  height?: number;

  constructor(data?: Partial<Media>) {
    super(data);
  }
}

@model()
export class EmbeddedURL extends Model {
  @property({
    type: 'string',
  })
  url?: string;

  @property({
    type: 'string',
  })
  title?: string;

  @property({
    type: 'string',
  })
  siteName?: string;

  @property({
    type: 'string',
  })
  description?: string;

  @property({
    type: 'object',
  })
  image?: Media;

  @property({
    type: 'object',
  })
  video?: Media;

  constructor(data?: Partial<EmbeddedURL>) {
    super(data);
  }
}
