import {intercept} from '@loopback/core';
import {Filter, repository} from '@loopback/repository';
import {get, getModelSchemaRef, param} from '@loopback/rest';
import {PaginationInterceptor} from '../interceptors';
import {Activity} from '../models';
import {ActivityRepository} from '../repositories';

export class ActivityController {
  constructor(
    @repository(ActivityRepository)
    protected activityRepository: ActivityRepository,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/activities', {
    responses: {
      '200': {
        description: 'Array of Activity model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(Activity, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(Activity, {exclude: ['limit', 'skip', 'offset']}) filter?: Filter<Activity>,
  ): Promise<Activity[]> {
    return this.activityRepository.find(filter);
  }
}
