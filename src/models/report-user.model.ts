import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'reportUsers',
    },
  },
})
export class ReportUser extends Entity {
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
  reportId: string;

  @property({
    type: 'string',
    required: true,
  })
  userId: string;

  constructor(data?: Partial<ReportUser>) {
    super(data);
  }
}

export interface ReportUserRelations {
  // describe navigational properties here
}

export type ReportUserWithRelations = ReportUser & ReportUserRelations;
