import {BindingScope, injectable, service} from '@loopback/core';
import {
  AnyObject,
  Count,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {
  PlatformType,
  ReferenceType,
  ReportStatusType,
  ReportType,
} from '../enums';
import {CreateReportDto, Report, UserReport} from '../models';
import {
  CommentRepository,
  ExperiencePostRepository,
  ExperienceRepository,
  FriendRepository,
  PeopleRepository,
  PostRepository,
  ReportRepository,
  UserExperienceRepository,
  UserReportRepository,
  UserRepository,
  UserSocialMediaRepository,
} from '../repositories';
import {MetricService} from './metric.service';
import {NotificationService} from './notification.service';

@injectable({scope: BindingScope.TRANSIENT})
export class ReportService {
  constructor(
    @repository(ReportRepository)
    private reportRepository: ReportRepository,
    @repository(CommentRepository)
    private commentRepository: CommentRepository,
    @repository(ExperienceRepository)
    private experienceRepository: ExperienceRepository,
    @repository(ExperiencePostRepository)
    private experiencePostRepository: ExperiencePostRepository,
    @repository(FriendRepository)
    private friendRepository: FriendRepository,
    @repository(PeopleRepository)
    private peopleRepository: PeopleRepository,
    @repository(PostRepository)
    private postRepository: PostRepository,
    @repository(UserExperienceRepository)
    private userExperienceRepository: UserExperienceRepository,
    @repository(UserRepository)
    private userRepository: UserRepository,
    @repository(UserReportRepository)
    private userReportRepository: UserReportRepository,
    @repository(UserSocialMediaRepository)
    private userSocialMediaRepository: UserSocialMediaRepository,
    @service(MetricService)
    private metricService: MetricService,
    @service(NotificationService)
    private notificationService: NotificationService,
  ) {}

  public async create(id: string, data: CreateReportDto): Promise<Report> {
    const {referenceId, referenceType, type} = data;
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

    return this.updateReportStatus(currentReport)
      .then(result => this.afterCreate(result, id, data))
      .catch(err => {
        throw err;
      });
  }

  public async find(filter?: Filter<Report>): Promise<Report[]> {
    return this.reportRepository.find(
      Object.assign(filter ?? {}, {
        include: [
          {
            relation: 'reporters',
            scope: {
              limit: 5,
            },
          },
        ],
      }),
    );
  }

  public async findById(id: string, filter?: Filter<Report>): Promise<Report> {
    return this.reportRepository.findById(id, filter);
  }

  public async findReporters(
    id: string,
    filter?: Filter<UserReport>,
  ): Promise<UserReport[]> {
    return this.reportRepository.reporters(id).find(filter);
  }

  public async updateById(id: string, report: Partial<Report>): Promise<void> {
    Promise.allSettled([
      this.reportRepository.updateById(id, report),
      this.notificationService.sendReportResponseToUser(id),
      this.notificationService.sendReportResponseToReporters(id),
    ]) as Promise<AnyObject>;
  }

  public async deleteById(id: string): Promise<void> {
    return this.reportRepository.deleteById(id);
  }

  public async deleteAll(where?: Where<Report>): Promise<Count> {
    return this.reportRepository.deleteAll(where);
  }

  public async updateReport(
    referenceId: string,
    referenceType: ReferenceType,
    restored: boolean,
  ): Promise<void> {
    const data = !restored
      ? {deletedAt: new Date().toString()}
      : {$unset: {deletedAt: ''}};

    if (restored) {
      this.reportRepository
        .find({
          where: {
            referenceType,
            referenceId,
          },
        })
        .then(reports => {
          const reportIds = reports.map(report => report.id ?? '');
          return this.userReportRepository.deleteAll({
            reportId: {inq: reportIds},
          });
        }) as Promise<AnyObject>;
    }

    switch (referenceType) {
      case ReferenceType.POST: {
        let postId = '';
        let importedURL = '';
        let userId = '';

        return this.postRepository
          .findById(referenceId)
          .then(({platform, url, createdBy}) => {
            if (platform === PlatformType.MYRIAD) postId = referenceId;
            else if (url) importedURL = url;

            userId = createdBy;

            return this.postRepository.updateAll(data, {
              or: [{id: postId}, {url: importedURL}],
            });
          })
          .then(() => {
            if (importedURL) {
              return this.postRepository.find({where: {url: importedURL}});
            }

            return [];
          })
          .then(posts => {
            const postIds = posts.map(post => post.id);
            return this.experiencePostRepository.updateAll(data, {
              postId: {inq: [...postIds, referenceId]},
            });
          })
          .then(() => this.metricService.userMetric(userId))
          .catch(err => {
            throw err;
          });
      }

      case ReferenceType.COMMENT: {
        return this.commentRepository.updateById(referenceId, data);
      }

      case ReferenceType.USER: {
        return this.handleUserReports(referenceId, data, restored);
      }
    }
  }

  // ------------------------------------------------

  // ------ PrivateFunction --------------------------

  private async afterCreate(
    report: Report,
    userId: string,
    data: CreateReportDto,
  ): Promise<Report> {
    Promise.allSettled([
      this.notificationService.sendReport(report),
      this.userReportRepository
        .findOne({
          where: {
            reportId: report.id,
            reportedBy: userId,
          },
        })
        .then(userReport => {
          if (userReport) return;
          return this.userReportRepository.create({
            referenceType: report.referenceType,
            description: data.description,
            reportedBy: userId,
            reportId: report.id,
          });
        })
        .then(userReport => {
          if (!userReport) return {count: 0};
          return this.userReportRepository.count({
            reportId: report.id?.toString() ?? '',
          });
        })
        .then(({count}) => {
          return this.reportRepository.updateById(report.id, {
            totalReported: count,
            status: report.status,
          });
        }),
    ]) as Promise<AnyObject>;

    return report;
  }

  private async handleUserReports(
    userId: string,
    data: AnyObject,
    restored: boolean,
  ): Promise<void> {
    Promise.allSettled([
      this.userRepository.updateById(userId, data),
      this.friendRepository.updateAll(data, {requesteeId: userId}),
      this.experienceRepository.updateAll(data, {createdBy: userId}),
      this.metricService.userMetric(userId),
      this.metricService.countServerMetric(),
      this.userSocialMediaRepository.find({where: {userId}}).then(people => {
        const peopleIds = people.map(e => e.id);
        return this.peopleRepository.updateAll(data, {id: {inq: peopleIds}});
      }),
      this.experienceRepository
        .find({where: {createdBy: userId}})
        .then(experiences => {
          const experienceIds = experiences.map(e => e?.id ?? '');
          const promises = !restored
            ? [
                this.userExperienceRepository.deleteAll({
                  experienceId: {inq: experienceIds},
                  subscribed: true,
                }),
              ]
            : [];

          promises.push(
            this.userExperienceRepository.updateAll(data, {
              experienceId: {inq: experienceIds},
              subscribed: false,
            }),
          );
          return Promise.all(promises);
        }),
      this.postRepository.find({where: {createdBy: userId}}).then(posts => {
        const postIds = posts.map(e => e.id);
        return Promise.all([
          this.postRepository.updateAll(
            {banned: !restored},
            {id: {inq: postIds}},
          ),
          this.experiencePostRepository.updateAll(data, {
            postId: {inq: postIds},
          }),
        ]);
      }),
      this.friendRepository
        .find({where: {requesteeId: userId}})
        .then(friends => {
          return Promise.all(
            friends.map(({requestorId}) => {
              return this.metricService.userMetric(requestorId);
            }),
          );
        }),
      this.commentRepository.findOne({where: {userId}}).then(comment => {
        if (comment) {
          return Promise.all([
            this.commentRepository.updateAll(data, {userId: userId}),
            this.metricService.publicMetric(ReferenceType.POST, comment.postId),
          ]);
        }
      }),
    ]) as Promise<AnyObject>;
  }

  private async updateReportStatus(report: Report): Promise<Report> {
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

  private async validateReporter(
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

  private getReportedDetail(
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

  // ------------------------------------------------
}
