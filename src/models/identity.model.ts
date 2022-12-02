import {Model, property} from '@loopback/repository';

export class Identity extends Model {
  @property({
    type: 'string',
    require: true,
  })
  hash: string;

  @property({
    type: 'string',
    required: true,
  })
  userId: string;

  @property({
    type: 'number',
    required: false,
    default: () => Date.now() + 10 * 60 * 1000,
  })
  expiredAt: number;

  @property({
    type: 'number',
    required: false,
    default: () => Date.now(),
  })
  createdAt: number;

  @property({
    type: 'date',
    required: false,
    default: () => Date.now(),
  })
  updatedAt: number;

  constructor(data?: Partial<Identity>) {
    super(data);
  }
}
