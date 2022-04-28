import {intercept} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {
  response,
  post,
  getModelSchemaRef,
  param,
  requestBody,
  HttpErrors,
} from '@loopback/rest';
import {ReferenceType, ReportStatusType, ReportType} from '../enums';
import {CreateInterceptor} from '../interceptors';
import {Report, ReportDetail} from '../models';
import {
  ReportRepository,
  PostRepository,
  CommentRepository,
  UserRepository,
  UserReportRepository,
} from '../repositories';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
export class UserReportController {
  constructor(
    @repository(ReportRepository)
    protected reportRepository: ReportRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(UserReportRepository)
    protected userReportRepository: UserReportRepository,
  ) {}

  @intercept(CreateInterceptor.BINDING_KEY)
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
    return this.getReport(id, reportDetail);
  }

  async getReport(id: string, reportDetail: ReportDetail): Promise<Report> {
    const {referenceId, referenceType, type} = reportDetail;
    const [reported, report] = await Promise.all([
      this.validateReporter(referenceId, referenceType, id, type),
      this.reportRepository.findOne({
        where: {
          referenceId,
          referenceType,
          type,
        },
      }),
    ]);

    const currentReport =
      report ??
      (await this.reportRepository.create({
        reportedDetail: this.getReportedDetail(reported, referenceType),
        referenceType,
        referenceId,
        type,
      }));

    return this.updateReportStatus(currentReport);
  }

  async validateReporter(
    referenceId: string,
    referenceType: ReferenceType,
    id: string,
    type: ReportType,
  ): Promise<AnyObject> {
    if (referenceType === ReferenceType.POST) {
      if (!type) {
        throw new HttpErrors.UnprocessableEntity('Type cannot be empty');
      }

      const foundPost = await this.postRepository.findById(referenceId, {
        include: ['user'],
      });

      if (foundPost.createdBy === id) {
        throw new HttpErrors.UnprocessableEntity(
          'You cannot report your own post',
        );
      }

      return foundPost;
    }

    if (referenceType === ReferenceType.COMMENT) {
      if (!type) {
        throw new HttpErrors.UnprocessableEntity('Type cannot be empty');
      }

      const comment = await this.commentRepository.findById(referenceId, {
        include: ['user'],
      });

      if (comment.userId === id) {
        throw new HttpErrors.UnprocessableEntity(
          'You cannot report your own comment',
        );
      }

      return comment;
    }

    if (referenceType === ReferenceType.USER) {
      if (type) {
        throw new HttpErrors.UnprocessableEntity('Type cannot be filled');
      }

      if (referenceId === id) {
        throw new HttpErrors.UnprocessableEntity('You cannot report yourself');
      }

      return this.userRepository.findById(referenceId);
    }

    return {};
  }

  getReportedDetail(
    reported: AnyObject,
    referenceType: ReferenceType,
  ): AnyObject {
    if (referenceType === ReferenceType.POST) {
      return {
        title: reported.title,
        text: reported.text,
        platform: reported.platform,
        user: {
          id: reported.user?.id,
          name: reported.user?.name,
          username: reported.user?.username,
          profilePictureURL: reported.user?.profilePictureURL,
          createdAt: reported.user?.createdAt,
        },
      };
    }

    if (referenceType === ReferenceType.COMMENT) {
      return {
        text: reported.text,
        postId: reported.postId,
        user: {
          id: reported.user?.id,
          name: reported.user?.name,
          username: reported.user?.username,
          profilePictureURL: reported.user?.profilePictureURL,
          createdAt: reported.user?.createdAt,
        },
      };
    }

    return {
      user: {
        id: reported.id,
        name: reported.name,
        username: reported.username,
        profilePictureURL: reported.profilePictureURL,
        createdAt: reported.createdAt,
      },
    };
  }

  async updateReportStatus(report: Report): Promise<Report> {
    const {id: reportId, status} = report;
    switch (status) {
      case ReportStatusType.PENDING:
        return report;

      case ReportStatusType.REMOVED: {
        throw new HttpErrors.UnprocessableEntity(
          'This post/comment/user has been removed/banned',
        );
      }

      case ReportStatusType.IGNORED:
      default: {
        await this.userReportRepository.deleteAll({reportId});
        return Object.assign(report, {status: ReportStatusType.PENDING});
      }
    }
  }
}
