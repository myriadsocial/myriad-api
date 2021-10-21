import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
  patch,
  del,
  requestBody,
  response,
} from '@loopback/rest';
import {Report} from '../models';
import {ReportRepository} from '../repositories';
import {intercept} from '@loopback/context';
import {PaginationInterceptor} from '../interceptors';

export class ReportController {
  constructor(
    @repository(ReportRepository)
    public reportRepository: ReportRepository,
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
    return this.reportRepository.find(
      Object.assign(filter ?? {}, {
        include: [
          {
            relation: 'reportedUser',
          },
          {
            relation: 'reportedPost',
            scope: {
              include: ['user'],
            },
          },
        ],
      }),
    );
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
    return this.reportRepository.findById(
      id,
      Object.assign(filter ?? {}, {
        include: [
          {
            relation: 'reportedUser',
          },
          {
            relation: 'reportedPost',
            scope: {
              include: ['user'],
            },
          },
        ],
      }),
    );
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
            exclude: ['postId', 'userId'],
          }),
        },
      },
    })
    report: Partial<Report>,
  ): Promise<void> {
    await this.reportRepository.updateById(id, report);
  }

  @del('/reports/{id}')
  @response(204, {
    description: 'Report DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.reportRepository.deleteById(id);
  }
}
