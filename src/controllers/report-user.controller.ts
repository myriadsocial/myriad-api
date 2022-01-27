import {Filter, repository} from '@loopback/repository';
import {get, getModelSchemaRef, param} from '@loopback/rest';
import {UserReport} from '../models';
import {ReportRepository} from '../repositories';
import {intercept} from '@loopback/core';
import {PaginationInterceptor} from '../interceptors';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
export class ReportUserController {
  constructor(
    @repository(ReportRepository)
    protected reportRepository: ReportRepository,
  ) {}

  @authenticate.skip()
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
    return this.reportRepository.reporters(id).find(filter);
  }
}
