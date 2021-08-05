import {
  globalInterceptor,
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  service,
  ValueOrPromise,
} from '@loopback/core';
import {AnyObject, Count, repository, Where} from '@loopback/repository';
import {ControllerType, MethodType, TimelineType} from '../enums';
import {noneStatusFiltering} from '../helpers/filter-utils';
import {pageMetadata} from '../helpers/page-metadata.utils';
import {Experience, Post, User} from '../models';
import {
  CommentRepository,
  ConversationRepository,
  CryptocurrencyRepository,
  ExperienceRepository,
  NotificationRepository,
  PeopleRepository,
  PostRepository,
  TagRepository,
  TransactionHistoryRepository,
  TransactionRepository,
  UserRepository,
} from '../repositories';
import {ExperienceService, FriendService, TagService} from '../services';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
// @injectable({tags: {key: PaginationInterceptor.BINDING_KEY}})
@globalInterceptor('', {tags: {name: 'pagination'}})
export class PaginationInterceptor implements Provider<Interceptor> {
  // static readonly BINDING_KEY = `interceptors.${PaginationInterceptor.name}`;

  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(TransactionRepository)
    protected transactionRepository: TransactionRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @repository(TransactionHistoryRepository)
    protected transactionHistoryRepository: TransactionHistoryRepository,
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @repository(NotificationRepository)
    protected notificationRepository: NotificationRepository,
    @repository(CryptocurrencyRepository)
    protected cryptocurrencyRepository: CryptocurrencyRepository,
    @repository(ConversationRepository)
    protected conversationRepository: ConversationRepository,
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
    @repository(TagRepository)
    protected tagRepository: TagRepository,
    @service(ExperienceService)
    protected experienceService: ExperienceService,
    @service(TagService)
    protected tagService: TagService,
    @service(FriendService)
    protected friendService: FriendService,
  ) {}

  /**
   * This method is used by LoopBack context to produce an interceptor function
   * for the binding.
   *
   * @returns An interceptor function
   */
  value() {
    return this.intercept.bind(this);
  }

  /**
   * The logic to intercept an invocation
   * @param invocationCtx - Invocation context
   * @param next - A function to invoke next interceptor or the target method
   */
  async intercept(invocationCtx: InvocationContext, next: () => ValueOrPromise<InvocationResult>) {
    const result = await next();
    const methodName = invocationCtx.methodName;
    const className = invocationCtx.targetClass.name as ControllerType;

    let args = invocationCtx.args;
    let countResult = {count: 0};

    switch (methodName) {
      case MethodType.FIND: {
        let where: Where<AnyObject> = {};

        if (args[0]) {
          if (args[0].where) {
            where = args[0].where;
          }
        }

        countResult = await this.countTotal(className, where);
        break;
      }

      case MethodType.USERTIMELINE: {
        const [userId, sortBy, page, filter] = args;
        const where = await this.filterTimeline(userId, sortBy);

        if (!where) break;

        args = [page, filter];
        countResult = await this.countTotal(className, where);

        break;
      }

      case MethodType.USERFRIENDLIST: {
        const [userId, page, filter] = args;
        const friendIds = await this.friendService.getApprovedFriendIds(userId);

        if (!friendIds.length) break;

        const where = {
          id: {
            inq: friendIds,
          },
        } as Where<User>;

        args = [page, filter];
        countResult = await this.countTotal(className, where);
        break;
      }

      case MethodType.SEARCHEXPERIENCE: {
        const [q, page, filter] = args;

        if (!q) break;

        const pattern = new RegExp('^' + q, 'i');
        const where = {
          name: pattern,
          origin: true,
        } as Where<Experience>;

        args = [page, filter];
        countResult = await this.countTotal(className, where);
        break;
      }

      case MethodType.FINDCOMMENT: {
        const [postId, page, filter] = args;

        const where = {
          ...filter.where,
          postId,
        } as Where<Comment>;

        args = [page, filter];
        countResult = await this.countTotal(className, where);
        break;
      }
    }

    if (countResult.count === 0) {
      return {
        data: [],
        meta: {
          totalItemCount: 0,
          totalPageCount: 0,
          itemsPerPage: 0,
        },
      };
    } else {
      return {
        data: result,
        meta: pageMetadata(args, countResult.count),
      };
    }
  }

  async filterTimeline(userId: string, sortBy: TimelineType): Promise<Where<Post> | null> {
    let where = null;

    switch (sortBy) {
      case TimelineType.EXPERIENCE:
        where = await this.experienceService.filterByExperience(userId);
        break;

      case TimelineType.TRENDING:
        where = await this.tagService.filterByTrending();
        break;

      case TimelineType.FRIEND:
        where = await this.friendService.filterByFriends(userId);
        break;

      case TimelineType.ALL:
      default: {
        const approvedFriendIds = await this.friendService.getApprovedFriendIds(userId);
        const trendingTopics = await this.tagService.trendingTopics();

        const experience = await this.experienceService.getExperience(userId);
        const experienceTopics = experience ? noneStatusFiltering(experience.tags) : [];
        const experiencePersonIds = experience ? noneStatusFiltering(experience.people) : [];

        const friends = [...approvedFriendIds, userId];
        const topics = [...trendingTopics, ...experienceTopics];
        const personIds = experiencePersonIds;

        if (!friends.length && !topics.length && !personIds.length) break;

        const joinTopics = topics.join('|');
        const regexTopic = new RegExp(joinTopics, 'i');

        where = {
          or: [
            {
              tags: {
                inq: topics,
              },
            },
            {
              title: regexTopic,
            },
            {
              text: regexTopic,
            },
            {
              peopleId: {
                inq: personIds,
              },
            },
            {
              importBy: {
                inq: friends,
              },
            },
            {
              walletAddress: {
                inq: friends,
              },
            },
          ],
        } as Where<Post>;
      }
    }

    return where;
  }

  async countTotal(className: ControllerType, where: Where<AnyObject>): Promise<Count> {
    let countResult: Count;

    switch (className) {
      case ControllerType.USER:
        countResult = await this.userRepository.count(where);
        break;

      case ControllerType.POST:
      case ControllerType.USERPOST:
        countResult = await this.postRepository.count(where);
        break;

      case ControllerType.TRANSACTION:
        countResult = await this.transactionRepository.count(where);
        break;

      case ControllerType.EXPERIENCE:
        countResult = await this.experienceRepository.count(where);
        break;

      case ControllerType.PEOPLE:
        countResult = await this.peopleRepository.count(where);
        break;

      case ControllerType.TRANSACTIONHISTORY:
        countResult = await this.transactionHistoryRepository.count(where);
        break;

      case ControllerType.TAG:
        countResult = await this.tagRepository.count(where);
        break;

      case ControllerType.NOTIFICATION:
        countResult = await this.notificationRepository.count(where);
        break;

      case ControllerType.CRYPTOCURRENCY:
        countResult = await this.cryptocurrencyRepository.count(where);
        break;

      case ControllerType.CONVERSATION:
        countResult = await this.conversationRepository.count(where);
        break;

      case ControllerType.POSTCOMMENT:
        countResult = await this.commentRepository.count(where);
        break;

      default:
        countResult = {
          count: 0,
        };
    }

    return countResult;
  }
}
