import {AnyObject, Count, repository, Where} from '@loopback/repository';
import {
  ControllerType,
  FriendStatusType,
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
  UserCurrencyRepository,
  ExperiencePostRepository,
  WalletRepository,
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
    @repository(ExperiencePostRepository)
    protected experiencePostRepository: ExperiencePostRepository,
    @repository(UserSocialMediaRepository)
    protected userSocialMediaRepository: UserSocialMediaRepository,
    @repository(TagRepository)
    protected tagRepository: TagRepository,
    @repository(UserExperienceRepository)
    protected userExpRepository: UserExperienceRepository,
    @repository(ActivityLogRepository)
    protected activityLogRepository: ActivityLogRepository,
    @repository(ReportRepository)
    protected reportRepository: ReportRepository,
    @repository(UserReportRepository)
    protected userReportRepository: UserReportRepository,
    @repository(UserCurrencyRepository)
    protected userCurrencyRepository: UserCurrencyRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
  ) {}

  async publicMetric(
    referenceType: ReferenceType,
    referenceId: string,
  ): Promise<Metric> {
    let exists = false;
    if (referenceType === ReferenceType.POST) {
      exists = await this.postRepository.exists(referenceId);
    } else {
      exists = await this.commentRepository.exists(referenceId);
    }

    if (!exists) return {upvotes: 0, downvotes: 0};

    const upvote = await this.voteRepository.count({
      type: referenceType,
      referenceId,
      state: true,
    });
    const downvote = await this.voteRepository.count({
      type: referenceType,
      referenceId,
      state: false,
    });

    const metric: Metric = {
      upvotes: upvote.count,
      downvotes: downvote.count,
    };

    if (referenceType === ReferenceType.COMMENT) {
      const {count: countComment} = await this.commentRepository.count({
        referenceId,
        deleteByUser: false,
        deletedAt: {exists: false},
      });

      await this.commentRepository.updateById(referenceId, {
        metric: {
          ...metric,
          comments: countComment,
        },
      });

      return Object.assign(metric, {comments: countComment});
    }

    const countDebate = await this.countComment(
      [referenceId],
      SectionType.DEBATE,
    );
    const countDiscussion = await this.countComment(
      [referenceId],
      SectionType.DISCUSSION,
    );

    const {count: countTip} = await this.transactionRepository.count({
      referenceId: referenceId,
      type: referenceType,
    });

    metric.debates = countDebate;
    metric.discussions = countDiscussion;
    metric.comments = (countDebate ?? 0) + (countDiscussion ?? 0);
    metric.tips = countTip;

    await this.postRepository.updateById(referenceId, {metric});

    return metric;
  }

  async userMetric(userId: string): Promise<void> {
    if (!userId) return;

    const {count: totalExperiences} = await this.userExpRepository.count({
      userId: userId,
      deletedAt: {exists: false},
    });
    const {count: totalFriends} = await this.friendRepository.count({
      requestorId: userId,
      status: FriendStatusType.APPROVED,
      deletedAt: {exists: false},
    });
    const {count: totalPosts} = await this.postRepository.count({
      createdBy: userId,
      banned: false,
      deletedAt: {exists: false},
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

  async countTags(tags: string[]): Promise<void> {
    if (tags.length === 0) return;

    for (const tag of tags) {
      const {count} = await this.postRepository.count({
        tags: {inq: [[tag], [tag.toUpperCase()], [tag.toLowerCase()]]},
        deletedAt: {exists: false},
      });

      const found = await this.tagRepository.findOne({
        where: {id: {regexp: new RegExp(`\\b${tag}\\b`, 'i')}},
      });

      if (!found) continue;
      await this.tagRepository.updateById(found.id, {
        count,
        updatedAt: new Date().toString(),
      });
    }
  }

  async countData(
    controller: ControllerType,
    where: Where<AnyObject>,
    additionalData?: string,
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
        return this.userExpRepository.count(where);

      case ControllerType.COMMENT:
        return this.commentRepository.count(where);

      case ControllerType.ACTIVITYLOG:
        return this.activityLogRepository.count(where);

      case ControllerType.REPORT:
        return this.reportRepository.count(where);

      case ControllerType.REPORTUSER:
        return this.userReportRepository.count(where);

      case ControllerType.USERCURRENCY:
        return this.userCurrencyRepository.count(where);

      case ControllerType.EXPERIENCEPOST: {
        const experienceId = additionalData;
        return this.experiencePostRepository.count({experienceId});
      }

      case ControllerType.USERWALLET:
        return this.walletRepository.count(where);

      default:
        return {
          count: 0,
        };
    }
  }

  async countPopularPost(postId: string): Promise<void> {
    const exists = await this.postRepository.exists(postId);
    if (!exists) return;
    const {count: voteCount} = await this.voteRepository.count({
      postId: postId,
      state: true,
    });
    const {count: commentCount} = await this.commentRepository.count({
      postId: postId,
      deleteByUser: false,
      deletedAt: {exists: false},
    });

    await this.postRepository.updateById(postId, {
      popularCount: commentCount + voteCount,
    });
  }

  async countComment(
    referenceIds: string[],
    section: SectionType,
  ): Promise<number> {
    const comments = await this.commentRepository.find(<AnyObject>{
      where: {
        referenceId: {inq: referenceIds},
        section: section,
        deleteByUser: false,
        deletedAt: {
          $exists: false,
        },
      },
    });

    if (comments.length === 0) return 0;
    const commentIds = comments.map(comment => comment.id ?? '');
    return comments.length + (await this.countComment(commentIds, section));
  }
}
