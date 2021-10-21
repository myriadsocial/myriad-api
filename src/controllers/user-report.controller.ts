import {service} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  response,
  post,
  getModelSchemaRef,
  param,
  requestBody,
  HttpErrors,
} from '@loopback/rest';
import {ReferenceType, ReportStatusType} from '../enums';
import {Report, ReportDetail} from '../models';
import {ReportRepository, UserReportRepository} from '../repositories';
import {NotificationService} from '../services';

export class UserReportController {
  constructor(
    @repository(ReportRepository)
    protected reportRepository: ReportRepository,
    @repository(UserReportRepository)
    protected userReportRepository: UserReportRepository,
    @service(NotificationService)
    protected notificationService: NotificationService,
  ) {}

  @post('/users/{id}/reports')
  @response(200, {
    description: 'Report model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Report),
      },
    },
  })
  async create(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ReportDetail, {
            title: 'NewReport',
            optional: ['type'],
          }),
        },
      },
    })
    reportDetail: ReportDetail,
  ): Promise<Report> {
    // TODO: Added notification service when report a post or a user
    const {referenceId, referenceType, description, type} = reportDetail;

    if (referenceType === ReferenceType.POST && !type) {
      throw new HttpErrors.UnprocessableEntity('Type cannot be empty');
    }

    let report = await this.reportRepository.findOne({
      where: {
        referenceId,
        referenceType,
        type,
        status: ReportStatusType.PENDING,
      },
    });

    if (!report) {
      report = await this.reportRepository.create(
        Object.assign(
          {
            referenceType,
            referenceId,
            type,
          },
          referenceType === ReferenceType.POST
            ? {postId: referenceId}
            : {userId: referenceId},
        ),
      );
    }

    const found = await this.userReportRepository.findOne({
      where: {
        reportId: report.id,
        reportedBy: id,
      },
    });

    if (found)
      throw new HttpErrors.UnprocessableEntity(
        'You have already reported this ' + referenceType,
      );

    await this.userReportRepository.create({
      description,
      reportedBy: id,
      reportId: report.id,
    });

    const {count} = await this.userReportRepository.count({
      reportId: report.id?.toString(),
    });

    await this.reportRepository.updateById(report.id, {totalReported: count});

    return report;
  }
}
