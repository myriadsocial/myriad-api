import {service} from '@loopback/core';
import {Count, CountSchema, repository, Where} from '@loopback/repository';
import {
  del,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import {User, Report} from '../models';
import {UserRepository} from '../repositories';
import {NotificationService} from '../services';

export class UserReportController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @service(NotificationService)
    protected notificationService: NotificationService,
  ) {}

  @post('/users/{id}/reports', {
    responses: {
      '200': {
        description: 'create a Report model instance',
        content: {'application/json': {schema: getModelSchemaRef(Report)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof User.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Report, {
            title: 'NewReportInUser',
            exclude: ['id', 'status', 'postId', 'userId', 'totalReported'],
          }),
        },
      },
    })
    report: Omit<Report, 'id'>,
  ): Promise<Report> {
    const {referenceId, referenceType} = report;

    try {
      await this.notificationService.sendReport(id, referenceId, referenceType);
    } catch {
      // ignore
    }

    return this.userRepository.reports(id).create(report);
  }

  @patch('/users/{id}/reports', {
    responses: {
      '200': {
        description: 'User.Report PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Report, {partial: true}),
        },
      },
    })
    report: Partial<Report>,
    @param.query.object('where', getWhereSchemaFor(Report))
    where?: Where<Report>,
  ): Promise<Count> {
    return this.userRepository.reports(id).patch(report, where);
  }

  @del('/users/{id}/reports', {
    responses: {
      '200': {
        description: 'User.Report DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Report))
    where?: Where<Report>,
  ): Promise<Count> {
    return this.userRepository.reports(id).delete(where);
  }
}
