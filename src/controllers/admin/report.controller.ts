import {authenticate} from '@loopback/authentication';
import {intercept} from '@loopback/context';
import {service} from '@loopback/core';
import {Filter, FilterExcludingWhere} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  requestBody,
  response,
} from '@loopback/rest';
import {PermissionKeys} from '../../enums';
import {PaginationInterceptor} from '../../interceptors';
import {Report} from '../../models';
import {AdminService} from '../../services';

@authenticate({strategy: 'jwt', options: {required: [PermissionKeys.ADMIN]}})
export class ReportController {
  constructor(
    @service(AdminService)
    private adminService: AdminService,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/reports')
  @response(200, {
    description: 'Array of Report model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Report, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Report, {exclude: ['limit', 'skip', 'offset', 'include']})
    filter?: Filter<Report>,
  ): Promise<Report[]> {
    return this.adminService.reports(filter);
  }

  @get('/reports/{id}')
  @response(200, {
    description: 'Report model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Report, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Report, {exclude: ['where', 'include']})
    filter?: FilterExcludingWhere<Report>,
  ): Promise<Report> {
    return this.adminService.report(id, filter);
  }

  @patch('/reports/{id}')
  @response(204, {
    description: 'Report PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Report, {
            partial: true,
            exclude: ['id', 'referenceType', 'referenceId', 'totalReported'],
          }),
        },
      },
    })
    report: Partial<Report>,
  ): Promise<void> {
    return this.adminService.processReport(id, report);
  }

  @del('/reports/{id}')
  @response(204, {
    description: 'Report DELETE success',
  })
  async restore(@param.path.string('id') id: string): Promise<void> {
    await this.adminService.removeReport(id);
  }
}
