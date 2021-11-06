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
import {ReferenceType, ReportStatusType, ReportType} from '../enums';
import {Report, ReportDetail} from '../models';
import {
  ReportRepository,
  UserReportRepository,
  PostRepository,
  CommentRepository,
  UserRepository,
} from '../repositories';
import {NotificationService} from '../services';

export class UserReportController {
  constructor(
    @repository(ReportRepository)
    protected reportRepository: ReportRepository,
    @repository(UserReportRepository)
    protected userReportRepository: UserReportRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
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
    const report = await this.getReport(referenceId, referenceType, type, id);

    switch (report.status) {
      case ReportStatusType.PENDING:
        break;

      case ReportStatusType.IGNORED:
      case ReportStatusType.APPROVED: {
        report.status = ReportStatusType.PENDING;
        break;
      }

      case ReportStatusType.REMOVED: {
        throw new HttpErrors.UnprocessableEntity(
          'This post/comment/user has been removed/banned',
        );
      }

      default: {
        report.status = ReportStatusType.PENDING;
        if (report.referenceType === ReferenceType.USER) {
          report.penaltyStatus = undefined;
        }
      }
    }

    await this.userReportRepository.create({
      referenceType,
      description,
      reportedBy: id,
      reportId: report.id,
    });

    const {count} = await this.userReportRepository.count({
      reportId: report.id?.toString(),
    });

    await this.reportRepository.updateById(report.id, {totalReported: count});

    return Object.assign(report, {totalReported: count});
  }

  async getReport(
    referenceId: string,
    referenceType: ReferenceType,
    type: ReportType,
    id: string,
  ): Promise<Report> {
    await this.validateReporter(referenceId, referenceType, id, type);

    let report = await this.reportRepository.findOne({
      where: {
        referenceId,
        referenceType,
        type,
      },
    });

    if (!report) {
      let reportedDetail = null;

      if (referenceType === ReferenceType.POST) {
        const post = await this.postRepository.findById(referenceId, {
          include: ['user'],
        });

        reportedDetail = {
          title: post.title,
          text: post.text,
          platform: post.platform,
          user: {
            id: post.user?.id,
            name: post.user?.name,
            username: post.user?.username,
            profilePictureURL: post.user?.profilePictureURL,
            createdAt: post.user?.createdAt,
          },
        };
      } else if (referenceType === ReferenceType.COMMENT) {
        const comment = await this.commentRepository.findById(referenceId, {
          include: ['user'],
        });

        reportedDetail = {
          text: comment.text,
          postId: comment.postId,
          user: {
            id: comment.user?.id,
            name: comment.user?.name,
            username: comment.user?.username,
            profilePictureURL: comment.user?.profilePictureURL,
            createdAt: comment.user?.createdAt,
          },
        };
      } else {
        const user = await this.userRepository.findById(referenceId);

        reportedDetail = {
          user: {
            id: user.id,
            name: user.name,
            username: user.username,
            profilePictureURL: user.profilePictureURL,
            createdAt: user.createdAt,
          },
        };
      }

      report = await this.reportRepository.create({
        reportedDetail,
        referenceType,
        referenceId,
        type,
      });
    }

    return report;
  }

  async validateReporter(
    referenceId: string,
    referenceType: ReferenceType,
    id: string,
    type: ReportType,
  ): Promise<void> {
    if (referenceType === ReferenceType.POST) {
      if (!type) {
        throw new HttpErrors.UnprocessableEntity('Type cannot be empty');
      }

      const {createdBy} = await this.postRepository.findById(referenceId);

      if (createdBy === id) {
        throw new HttpErrors.UnprocessableEntity(
          'You cannot report your own post',
        );
      }
    }

    if (referenceType === ReferenceType.COMMENT) {
      if (!type) {
        throw new HttpErrors.UnprocessableEntity('Type cannot be empty');
      }

      const {userId} = await this.commentRepository.findById(referenceId);

      if (userId === id) {
        throw new HttpErrors.UnprocessableEntity(
          'You cannot report your own comment',
        );
      }
    }

    if (referenceType === ReferenceType.USER) {
      if (type) {
        throw new HttpErrors.UnprocessableEntity('Type cannot be filled');
      }

      if (referenceId === id) {
        throw new HttpErrors.UnprocessableEntity('You cannot report yourself');
      }
    }
  }
}
