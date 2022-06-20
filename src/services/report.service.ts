import {BindingScope, injectable, service} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {PlatformType, ReferenceType} from '../enums';
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

@injectable({scope: BindingScope.TRANSIENT})
export class ReportService {
  constructor(
    @repository(ReportRepository)
    public reportRepository: ReportRepository,
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
    @repository(ExperiencePostRepository)
    protected experiencePostRepository: ExperiencePostRepository,
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(UserExperienceRepository)
    protected userExperienceRepository: UserExperienceRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(UserReportRepository)
    protected userReportRepository: UserReportRepository,
    @repository(UserSocialMediaRepository)
    protected userSocialMediaRepository: UserSocialMediaRepository,
    @service(MetricService)
    protected metricService: MetricService,
  ) {}

  async updateReport(
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
          .then(() => this.metricService.userMetric(userId));
      }

      case ReferenceType.COMMENT: {
        return this.commentRepository.updateById(referenceId, data);
      }

      case ReferenceType.USER: {
        return this.handleUserReports(referenceId, data, restored);
      }
    }
  }

  async handleUserReports(
    userId: string,
    data: AnyObject,
    restored: boolean,
  ): Promise<void> {
    Promise.allSettled([
      this.userRepository.updateById(userId, data),
      this.friendRepository.updateAll(data, {requesteeId: userId}),
      this.experienceRepository.updateAll(data, {createdBy: userId}),
      this.metricService.userMetric(userId),
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
}
