import {AnyObject, Count, repository, Where} from '@loopback/repository';
import {
  ControllerType,
  FriendStatusType,
  MethodType,
  PlatformType,
  ReferenceType,
  SectionType,
} from '../enums';
import {Metric} from '../interfaces';
import {
  ActivityLogRepository,
  CommentRepository,
  CurrencyRepository,
  ExperienceRepository,
  FriendRepository,
  VoteRepository,
  NotificationRepository,
  PeopleRepository,
  PostRepository,
  TagRepository,
  TransactionRepository,
  UserExperienceRepository,
  UserRepository,
  UserSocialMediaRepository,
  ReportRepository,
  UserReportRepository,
} from '../repositories';
import {injectable, BindingScope} from '@loopback/core';

@injectable({scope: BindingScope.TRANSIENT})
export class MetricService {
  constructor(
    @repository(VoteRepository)
    protected voteRepository: VoteRepository,
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(TransactionRepository)
    protected transactionRepository: TransactionRepository,
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @repository(NotificationRepository)
    protected notificationRepository: NotificationRepository,
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
    @repository(UserSocialMediaRepository)
    protected userSocialMediaRepository: UserSocialMediaRepository,
    @repository(TagRepository)
    protected tagRepository: TagRepository,
    @repository(UserExperienceRepository)
    protected userExperienceRepository: UserExperienceRepository,
    @repository(ActivityLogRepository)
    protected activityLogRepository: ActivityLogRepository,
    @repository(ReportRepository)
    protected reportRepository: ReportRepository,
    @repository(UserReportRepository)
    protected userReportRepository: UserReportRepository,
  ) {}

  async publicMetric(
    type: ReferenceType,
    referenceId: string,
    postId?: string,
    section?: SectionType,
  ): Promise<Metric> {
    const upvote = await this.voteRepository.count({
      type,
      referenceId,
      state: true,
    });
    const downvote = await this.voteRepository.count({
      type,
      referenceId,
      state: false,
    });

    const metric: Metric = {
      upvotes: upvote.count,
      downvotes: downvote.count,
    };

    if (!section) return metric;
    if (section === SectionType.DEBATE) {
      metric.debates = (
        await this.commentRepository.count({
          postId,
          section: SectionType.DEBATE,
        })
      ).count;
    }

    if (section === SectionType.DISCUSSION) {
      metric.discussions = (
        await this.commentRepository.count({
          postId,
          section: SectionType.DISCUSSION,
        })
      ).count;
    }

    metric.comments = (metric.discussions ?? 0) + (metric.debates ?? 0);

    return metric;
  }

  async userMetric(userId: string): Promise<void> {
    const {count: totalExperiences} = await this.userExperienceRepository.count(
      {userId},
    );
    const {count: totalFriends} = await this.friendRepository.count({
      requestorId: userId,
      status: FriendStatusType.APPROVED,
    });
    const {count: totalPosts} = await this.postRepository.count({
      createdBy: userId,
      platform: PlatformType.MYRIAD,
    });

    const {count: totalUpvote} = await this.voteRepository.count({
      state: true,
      toUserId: userId,
    });

    const {count: totalDownvote} = await this.voteRepository.count({
      state: false,
      toUserId: userId,
    });

    const userMetric = {
      totalPosts,
      totalExperiences,
      totalFriends,
      totalKudos: totalUpvote - totalDownvote,
    };

    await this.userRepository.updateById(userId, {metric: userMetric});
  }

  async countData(
    controller: ControllerType,
    methodName: MethodType,
    where: Where<AnyObject>,
  ): Promise<Count> {
    switch (controller) {
      case ControllerType.USER:
        return this.userRepository.count(where);

      case ControllerType.POST:
        return this.postRepository.count(where);

      case ControllerType.TRANSACTION:
        return this.transactionRepository.count(where);

      case ControllerType.EXPERIENCE:
        return this.experienceRepository.count(where);

      case ControllerType.PEOPLE:
        return this.peopleRepository.count(where);

      case ControllerType.TAG:
        return this.tagRepository.count(where);

      case ControllerType.NOTIFICATION:
        return this.notificationRepository.count(where);

      case ControllerType.CURRENCY:
        return this.currencyRepository.count(where);

      case ControllerType.USERSOCIALMEDIA:
        return this.userSocialMediaRepository.count(where);

      case ControllerType.FRIEND:
        return this.friendRepository.count(where);

      case ControllerType.USEREXPERIENCE:
        return this.userExperienceRepository.count(where);

      case ControllerType.COMMENT:
        return this.commentRepository.count(where);

      case ControllerType.ACTIVITYLOG:
        return this.activityLogRepository.count(where);

      case ControllerType.REPORT:
        return this.reportRepository.count(where);

      case ControllerType.DELETEDCOLLECTIONCONTROLLER:
        return this.countDeletedData(methodName, where);

      case ControllerType.REPORTUSERCONTROLLER:
        return this.userReportRepository.count(where);

      default:
        return {
          count: 0,
        };
    }
  }

  async countDeletedData(
    methodName: MethodType,
    where: Where<AnyObject>,
  ): Promise<Count> {
    switch (methodName) {
      case MethodType.DELETEDUSERLIST:
        return this.userRepository.count(where);

      case MethodType.DELETEDPOSTLIST:
        return this.postRepository.count(where);

      default:
        return {
          count: 0,
        };
    }
  }

  async countPopularPost(postId: string): Promise<number> {
    const post = await this.postRepository.findOne({where: {id: postId}});
    if (!post) return 0;

    const {count: voteCount} = await this.voteRepository.count({
      postId: post.id,
      state: true,
    });
    const {count: commentCount} = await this.commentRepository.count({
      postId: post.id,
    });

    return commentCount + voteCount;
  }
}
