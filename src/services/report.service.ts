import {BindingScope, injectable, service} from '@loopback/core';
import {AnyObject, Count, repository} from '@loopback/repository';
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
    let data: AnyObject = {
      $unset: {
        deletedAt: '',
      },
    };

    if (!restored) data = {deletedAt: new Date().toString()};
    else {
      const reports = await this.reportRepository.find({
        where: {
          referenceType,
          referenceId,
        },
      });

      const reportIds = reports.map(report => report.id ?? '');

      await this.userReportRepository.deleteAll({
        reportId: {inq: reportIds},
      });
    }

    switch (referenceType) {
      case ReferenceType.POST: {
        const {platform, url, createdBy} = await this.postRepository.findById(
          referenceId,
        );
        if (platform === PlatformType.MYRIAD) {
          await this.postRepository.updateById(referenceId, data);
          await this.experiencePostRepository.updateAll(data, {
            postId: referenceId,
          });
        } else {
          if (url) {
            const posts = await this.postRepository.find({where: {url}});
            const postIds = posts.map(post => post.id);

            await this.postRepository.updateAll(data, {url: url});
            await this.experiencePostRepository.updateAll(data, {
              postId: {inq: postIds},
            });
          }
        }

        await this.metricService.userMetric(createdBy);

        break;
      }

      case ReferenceType.COMMENT: {
        await this.commentRepository.updateById(referenceId, data);

        break;
      }

      case ReferenceType.USER: {
        await this.handleUserReports(referenceId, data, restored);

        break;
      }
    }
  }

  async handleUserReports(
    userId: string,
    data: AnyObject,
    restored: boolean,
  ): Promise<void> {
    const experienceIds = (
      await this.experienceRepository.find({
        where: {createdBy: userId},
      })
    ).map(e => e.id ?? '');
    const friends = await this.friendRepository.find({
      where: {requesteeId: userId},
    });
    const peopleIds = (
      await this.userSocialMediaRepository.find({
        where: {userId},
      })
    ).map(e => e.peopleId);
    const postIds = (
      await this.postRepository.find(<AnyObject>{
        where: {
          createdBy: userId,
        },
      })
    ).map(post => post.id);
    const comment = await this.commentRepository.findOne({
      where: {userId},
    });

    Promise.allSettled([
      this.userRepository.updateById(userId, data),
      this.friendRepository.updateAll(data, {requesteeId: userId}),
      this.experienceRepository.updateAll(data, {createdBy: userId}),
      this.postRepository.updateAll({banned: !restored}, {createdBy: userId}),
      this.metricService.userMetric(userId),
      this.peopleRepository.updateAll(data, {id: {inq: peopleIds}}),
      this.experiencePostRepository.updateAll(data, {
        or: [
          {
            postId: {
              inq: postIds,
            },
          },
          {
            id: {
              inq: experienceIds,
            },
          },
        ],
      }),
      this.userExperienceRepository.updateAll(data, {
        experienceId: {inq: experienceIds},
        subscribed: false,
      }),
      ...friends.map(async friend => {
        return this.metricService.userMetric(friend.requestorId);
      }),
    ]) as Promise<AnyObject>;

    if (!restored) {
      this.userExperienceRepository.deleteAll({
        experienceId: {inq: experienceIds},
        subscribed: true,
      }) as Promise<Count>;
    }

    if (comment) {
      Promise.allSettled([
        this.commentRepository.updateAll(data, {userId: userId}),
        this.metricService.publicMetric(ReferenceType.POST, comment.postId),
      ]) as Promise<AnyObject>;
    }
  }
}
