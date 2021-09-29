import {AnyObject, Count, repository, Where} from '@loopback/repository';
import {ControllerType, ReferenceType, SectionType} from '../enums';
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
} from '../repositories';

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
  ) {}

  async publicMetric(
    type: ReferenceType,
    referenceId: string,
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
    if (section === SectionType.DEBATE || type === ReferenceType.POST) {
      metric.debates = (
        await this.commentRepository.count({
          type,
          referenceId,
          section: SectionType.DEBATE,
        })
      ).count;
    }

    if (section === SectionType.DISCUSSION || type === ReferenceType.POST) {
      metric.discussions = (
        await this.commentRepository.count({
          type,
          referenceId,
          section: SectionType.DISCUSSION,
        })
      ).count;
    }

    return metric;
  }

  async countData(
    controller: ControllerType,
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

      default:
        return {
          count: 0,
        };
    }
  }
}
