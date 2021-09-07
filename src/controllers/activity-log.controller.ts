import {intercept} from '@loopback/core';
import {Filter, repository} from '@loopback/repository';
import {get, getModelSchemaRef, param} from '@loopback/rest';
import {PaginationInterceptor} from '../interceptors';
import {ActivityLog} from '../models';
import {ActivityLogRepository} from '../repositories';

export class ActivityLogController {
  constructor(
    @repository(ActivityLogRepository)
    protected activityLogRepository: ActivityLogRepository,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/activity-logs', {
    responses: {
      '200': {
        description: 'Array of Activity model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(ActivityLog, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(ActivityLog, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<ActivityLog>,
  ): Promise<ActivityLog[]> {
    return this.activityLogRepository.find(filter);
  }
}
