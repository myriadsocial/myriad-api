import {AnyObject, Count, repository, Where} from '@loopback/repository';
import {ControllerType, LikeType} from '../enums';
import {Metric} from '../interfaces';
import {
  CommentRepository,
  CurrencyRepository,
  ExperienceRepository,
  FriendRepository,
  LikeRepository,
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
    @repository(LikeRepository)
    protected likeRepository: LikeRepository,
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
  ) {}

  async publicMetric(type: LikeType, referenceId: string): Promise<Metric> {
    const like = await this.likeRepository.count({
      type,
      referenceId,
      state: true,
    });

    const dislike = await this.likeRepository.count({
      type,
      referenceId,
      state: false,
    });

    const comment = await this.commentRepository.count({
      postId: referenceId,
    });

    return {
      likes: like.count,
      dislikes: dislike.count,
      comments: comment.count,
    };
  }

  async countData(controller: ControllerType, where: Where<AnyObject>): Promise<Count> {
    let result: Count;

    switch (controller) {
      case ControllerType.USER:
        result = await this.userRepository.count(where);
        break;

      case ControllerType.POST:
      case ControllerType.USERPOST:
        result = await this.postRepository.count(where);
        break;

      case ControllerType.TRANSACTION:
        result = await this.transactionRepository.count(where);
        break;

      case ControllerType.EXPERIENCE:
        result = await this.experienceRepository.count(where);
        break;

      case ControllerType.PEOPLE:
        result = await this.peopleRepository.count(where);
        break;

      case ControllerType.TAG:
        result = await this.tagRepository.count(where);
        break;

      case ControllerType.NOTIFICATION:
        result = await this.notificationRepository.count(where);
        break;

      case ControllerType.CURRENCY:
        result = await this.currencyRepository.count(where);
        break;

      case ControllerType.USERSOCIALMEDIA:
        result = await this.userSocialMediaRepository.count(where);
        break;

      case ControllerType.FRIEND:
        result = await this.friendRepository.count(where);
        break;

      case ControllerType.USEREXPERIENCE:
        result = await this.userExperienceRepository.count(where);
        break;

      default:
        result = {
          count: 0,
        };
    }

    return result;
  }
}
