import {Fields, InclusionFilter, Model, model, property, Where} from '@loopback/repository';
import {TimelineType} from '../enums';

@model()
export class CustomFilter extends Model {
  @property({
    type: 'object',
  })
  where?: Where;

  @property({
    type: 'object',
  })
  fields?: Fields;

  @property({
    type: 'array',
    itemType: 'string',
  })
  order?: string[];

  @property({
    type: 'number',
  })
  limit?: number;

  @property({
    type: 'number',
  })
  page?: number;

  @property({
    type: 'array',
    itemType: 'object',
  })
  include?: InclusionFilter[];

  constructor(data?: Partial<CustomFilter>) {
    super(data);
  }
}

@model()
export class ExtendCustomFilter extends CustomFilter {
  @property({
    type: 'string',
  })
  findBy?: string;

  @property({
    type: 'string',
  })
  q?: string;

  @property({
    type: 'string',
    jsonSchema: {
      enum: Object.values(TimelineType),
    },
  })
  sortBy?: TimelineType;
}
