import {inject, intercept} from '@loopback/core';
import {Filter, repository} from '@loopback/repository';
import {get, getModelSchemaRef, param} from '@loopback/rest';
import {PaginationInterceptor} from '../interceptors';
import {ActivityLog} from '../models';
import {ActivityLogRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';
import {LoggingBindings, logInvocation, WinstonLogger} from '@loopback/logging';

@authenticate('jwt')
export class ActivityLogController {
  // Inject a winston logger
  @inject(LoggingBindings.WINSTON_LOGGER)
  private logger: WinstonLogger;

  constructor(
    @repository(ActivityLogRepository)
    protected activityLogRepository: ActivityLogRepository,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @logInvocation()
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
