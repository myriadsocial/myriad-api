import {authenticate} from '@loopback/authentication';
import {intercept, service} from '@loopback/core';
import {Filter} from '@loopback/repository';
import {get, getModelSchemaRef, param} from '@loopback/rest';
import {PaginationInterceptor} from '../interceptors';
import {UserReport} from '../models';
import {ReportService} from '../services';

@authenticate('jwt')
export class ReportUserController {
  constructor(
    @service(ReportService)
    protected reportService: ReportService,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/reports/{id}/users', {
    responses: {
      '200': {
        description: 'Array of Report has many UserReport',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(UserReport)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.filter(UserReport, {
      exclude: ['limit', 'skip', 'offset', 'include', 'where'],
    })
    filter?: Filter<UserReport>,
  ): Promise<UserReport[]> {
    return this.reportService.findReporters(id, filter);
  }
}
