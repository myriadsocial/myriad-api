import {BindingScope, injectable} from '@loopback/core';
import {AnyObject, Count, Filter, repository} from '@loopback/repository';
import {
  ControllerType,
  FriendStatusType,
  PlatformType,
  ReferenceType,
  SectionType,
} from '../enums';
import {Metric, ServerMetric, UserMetric} from '../interfaces';
import {UserSocialMedia} from '../models';
import {
  ActivityLogRepository,
  CommentRepository,
  CurrencyRepository,
  ExperiencePostRepository,
  ExperienceRepository,
  FriendRepository,
  NetworkRepository,
  NotificationRepository,
  PeopleRepository,
  PostRepository,
  ReportRepository,
  ServerRepository,
  TagRepository,
  TransactionRepository,
  UnlockableContentRepository,
  UserCurrencyRepository,
  UserExperienceRepository,
  UserReportRepository,
  UserRepository,
  UserSocialMediaRepository,
  VoteRepository,
  WalletRepository,
} from '../repositories';

@injectable({scope: BindingScope.TRANSIENT})
export class MetricService {
  constructor(
    @repository(VoteRepository)
    private voteRepository: VoteRepository,
    @repository(CommentRepository)
    private commentRepository: CommentRepository,
    @repository(PostRepository)
    private postRepository: PostRepository,
    @repository(UserRepository)
    private userRepository: UserRepository,
    @repository(TransactionRepository)
    private transactionRepository: TransactionRepository,
    @repository(FriendRepository)
    private friendRepository: FriendRepository,
    @repository(PeopleRepository)
    private peopleRepository: PeopleRepository,
    @repository(NotificationRepository)
    private notificationRepository: NotificationRepository,
    @repository(CurrencyRepository)
    private currencyRepository: CurrencyRepository,
    @repository(ExperienceRepository)
    private experienceRepository: ExperienceRepository,
    @repository(ExperiencePostRepository)
    private experiencePostRepository: ExperiencePostRepository,
    @repository(UserSocialMediaRepository)
    private userSocialMediaRepository: UserSocialMediaRepository,
    @repository(ServerRepository)
    private serverRepository: ServerRepository,
    @repository(TagRepository)
    private tagRepository: TagRepository,
    @repository(UserCurrencyRepository)
    private userCurrencyRepository: UserCurrencyRepository,
    @repository(UserExperienceRepository)
    private userExpRepository: UserExperienceRepository,
    @repository(ActivityLogRepository)
    private activityLogRepository: ActivityLogRepository,
    @repository(ReportRepository)
    private reportRepository: ReportRepository,
    @repository(UserReportRepository)
    private userReportRepository: UserReportRepository,
    @repository(WalletRepository)
    private walletRepository: WalletRepository,
    @repository(NetworkRepository)
    private networkRepository: NetworkRepository,
    @repository(UnlockableContentRepository)
    private unlockableContentRepository: UnlockableContentRepository,
  ) {}

  async publicMetric(
    referenceType: ReferenceType,
    referenceId: string,
    recountComment = true,
    totalDiscussions = 0,
    totalDebate = 0,
  ): Promise<Metric> {
    let exists = false;
    if (referenceType === ReferenceType.POST) {
      exists = await this.postRepository.exists(referenceId);
    } else {
      exists = await this.commentRepository.exists(referenceId);
    }

    if (!exists) return {upvotes: 0, downvotes: 0};

    const [upvote, downvote] = await Promise.all([
      this.voteRepository.count({
        type: referenceType,
        referenceId,
        state: true,
      }),
      this.voteRepository.count({
        type: referenceType,
        referenceId,
        state: false,
      }),
    ]);

    const metric: Metric = {
      upvotes: upvote.count,
      downvotes: downvote.count,
    };

    if (referenceType === ReferenceType.COMMENT) {
      const [{count: deletedComments}, {count: countComment}] =
        await Promise.all([
          this.commentRepository.count({
            referenceId,
            deleteByUser: true,
            deletedAt: {exists: true},
          }),
          this.commentRepository.count({
            referenceId,
            deleteByUser: false,
            deletedAt: {exists: false},
          }),
        ]);

      await this.commentRepository.updateById(referenceId, {
        metric: {
          ...metric,
          deletedComments,
          comments: countComment,
        },
      });

      return Object.assign(metric, {comments: countComment, deletedComments});
    }

    const {count: countTip} = await this.transactionRepository.count({
      referenceId: referenceId,
      type: referenceType,
    });

    Object.assign(metric, {
      debates: totalDebate,
      discussions: totalDiscussions,
      comments: totalDebate + totalDiscussions,
      tips: countTip,
    });

    if (recountComment) {
      const [countDebate, countDiscussion] = await Promise.all([
        this.countComment([referenceId], SectionType.DEBATE),
        this.countComment([referenceId], SectionType.DISCUSSION),
      ]);

      Object.assign(metric, {
        debates: countDebate,
        discussions: countDiscussion,
        comments: (countDebate ?? 0) + (countDiscussion ?? 0),
      });
    }

    await this.postRepository.updateById(referenceId, {metric});

    return metric;
  }

  async userMetric(userId: string): Promise<void> {
    if (!userId) return;

    const [
      {count: totalComments},
      {count: totalUpvote},
      {count: totalDownvote},
      {count: totalExperiences},
      {count: totalTransactions},
      {count: totalFriends},
      {count: totalPosts},
      {count: totalSubscriptions},
    ] = await Promise.all([
      this.commentRepository.count({userId, deletedAt: {exists: false}}),
      this.voteRepository.count({state: true, toUserId: userId}),
      this.voteRepository.count({state: false, toUserId: userId}),
      this.userExpRepository.count({userId, deletedAt: {exists: false}}),
      this.transactionRepository.count({from: userId}),
      this.friendRepository.count({
        requestorId: userId,
        status: FriendStatusType.APPROVED,
        deletedAt: {exists: false},
      }),
      this.postRepository.count({
        createdBy: userId,
        banned: false,
        deletedAt: {exists: false},
      }),
      this.userExpRepository.count({
        userId,
        subscribed: true,
        deletedAt: {exists: false},
      }),
    ]);

    const userMetric: UserMetric = {
      totalComments,
      totalPosts,
      totalSubscriptions,
      totalExperiences,
      totalFriends,
      totalTransactions,
      totalKudos: totalUpvote - totalDownvote,
    };

    await this.userRepository.updateById(userId, {metric: userMetric});
  }

  async countTags(tags: string[]): Promise<void> {
    if (tags.length === 0) return;

    for (const tag of tags) {
      const found = await this.tagRepository.findOne({
        where: {id: {regexp: new RegExp(`\\b${tag}\\b`, 'i')}},
      });

      if (!found) continue;
      const {count} = await this.postRepository.count({
        tags: {inq: [[tag], [tag.toUpperCase()], [tag.toLowerCase()]]},
        deletedAt: {exists: false},
      });

      await this.tagRepository.updateById(found.id, {
        count,
        updatedAt: new Date().toString(),
      });
    }
  }

  async countServerMetric(): Promise<void> {
    const server = await this.serverRepository.findOne();
    if (!server) return;

    const userSocialMediaCollection = (
      this.userSocialMediaRepository.dataSource.connector as AnyObject
    ).collection(UserSocialMedia.modelName);

    const [
      {count: totalUsers},
      {count: totalComments},
      {count: totalVotes},
      {count: totalTransactions},
      {count: totalExperiences},
      {count: totalSubscriptions},
      {count: totalMyriad},
      {count: totalTwitter},
      {count: totalReddit},
      {count: totalEmails},
      {count: totalNearWallet},
      {count: totalSubstrateWallet},
      connectedSocials,
    ] = await Promise.all([
      this.userRepository.count(),
      this.commentRepository.count(),
      this.voteRepository.count(),
      this.transactionRepository.count(),
      this.experienceRepository.count(),
      this.userExpRepository.count({subscribed: true}),
      this.postRepository.count({platform: PlatformType.MYRIAD}),
      this.postRepository.count({platform: PlatformType.TWITTER}),
      this.postRepository.count({platform: PlatformType.REDDIT}),
      this.userRepository.count(<AnyObject>{email: {$neq: null}}),
      this.walletRepository.count({networkId: 'near'}),
      this.walletRepository.count({networkId: {nin: ['near']}}),
      userSocialMediaCollection
        .aggregate([
          {
            $group: {
              _id: {platform: '$platform', userId: '$userId'},
            },
          },
          {
            $group: {
              _id: '$_id.platform',
              count: {$sum: 1},
            },
          },
        ])
        .get(),
    ]);

    let totalConnectedReddit = 0;
    let totalConnectedTwitter = 0;

    for (const social of connectedSocials) {
      switch (social._id) {
        case PlatformType.TWITTER:
          totalConnectedTwitter = social.count;
          break;

        case PlatformType.REDDIT:
          totalConnectedReddit = social.count;
          break;
      }
    }

    const metric: ServerMetric = {
      totalComments,
      totalPosts: {
        totalMyriad,
        totalTwitter,
        totalReddit,
        totalAll: totalMyriad + totalTwitter + totalReddit,
      },
      totalUsers,
      totalVotes,
      totalTransactions,
      totalExperiences,
      totalSubscriptions,
      totalEmails,
      totalWallets: {totalNearWallet, totalSubstrateWallet},
      totalConnectedSocials: {totalConnectedReddit, totalConnectedTwitter},
    };

    return this.serverRepository.updateById(server.id, {metric});
  }

  async countData(
    controller: ControllerType,
    filter: Filter<AnyObject>,
    additionalData?: string,
  ): Promise<Count> {
    const where = filter.where;

    switch (controller) {
      case ControllerType.USER: {
        if ((where as AnyObject)?.userId) {
          return this.activityLogRepository.count(where);
        }

        return this.userRepository.count(where);
      }

      case ControllerType.EXPERIENCEPOST:
      case ControllerType.USERPOST:
        if (additionalData) {
          const newWhere = {
            createdBy: additionalData,
            banned: false,
          };
          return this.postRepository.count(newWhere);
        }
      case ControllerType.POST:
        return this.postRepository.count(where);

      case ControllerType.USERTRANSACTION:
        return this.transactionRepository.count(where);

      case ControllerType.EXPERIENCE:
        return this.experienceRepository.count(where);

      case ControllerType.PEOPLE:
        return this.peopleRepository.count(where);

      case ControllerType.TAG:
        return this.tagRepository.count(where);

      case ControllerType.USERNOTIFICATION:
        return this.notificationRepository.count(where);

      case ControllerType.CURRENCY:
        return this.currencyRepository.count(where);

      case ControllerType.USERSOCIALMEDIA:
        return this.userSocialMediaRepository.count(where);

      case ControllerType.USERFRIEND:
        return this.friendRepository.count(where);

      case ControllerType.USEREXPERIENCE:
        return this.userExpRepository.count(where);

      case ControllerType.USERCOMMENT:
        return this.commentRepository.count(where);

      case ControllerType.REPORT:
        return this.reportRepository.count(where);

      case ControllerType.REPORTUSER:
        return this.userReportRepository.count(where);

      case ControllerType.NETWORK:
        return this.networkRepository.count(where);

      case ControllerType.POSTEXPERIENCE: {
        const id = additionalData;
        const additionalWhere = {postId: id, deletedAt: {exists: false}};
        return this.experiencePostRepository.count(additionalWhere);
      }

      case ControllerType.USERCURRENCY:
        return this.userCurrencyRepository.count(where);

      case ControllerType.USERWALLET:
        return this.walletRepository.count({...where, userId: additionalData});

      case ControllerType.USERUNLOCKABLECONTENT:
        return this.unlockableContentRepository.count(where);

      default:
        return {
          count: 0,
        };
    }
  }

  async countPopularPost(postId: string): Promise<void> {
    const exists = await this.postRepository.exists(postId);
    if (!exists) return;

    const [{count: voteCount}, {count: commentCount}] = await Promise.all([
      this.voteRepository.count({postId, state: true}),
      this.commentRepository.count({
        postId: postId,
        deleteByUser: false,
        deletedAt: {exists: false},
      }),
    ]);

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
          $eq: null,
        },
      },
    });

    if (comments.length === 0) return 0;
    const commentIds = comments.map(comment => comment.id ?? '');
    return comments.length + (await this.countComment(commentIds, section));
  }
}
