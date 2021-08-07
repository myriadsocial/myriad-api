import {
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  service,
  ValueOrPromise,
} from '@loopback/core';
import {AnyObject, Count, repository, Where} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {ControllerType, MethodType, TimelineType} from '../enums';
import {defaultFilterQuery, noneStatusFiltering} from '../helpers/filter-utils';
import {pageMetadata} from '../helpers/page-metadata.utils';
import {Post} from '../models';
import {
  CommentRepository,
  CurrencyRepository,
  ExperienceRepository,
  NotificationRepository,
  PeopleRepository,
  PostRepository,
  TagRepository,
  TransactionRepository,
  UserRepository,
  UserSocialMediaRepository,
} from '../repositories';
import {ExperienceService, FriendService, TagService} from '../services';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
// @injectable({tags: {key: PaginationInterceptor.BINDING_KEY}})

@injectable({tags: {key: PaginationInterceptor.BINDING_KEY}})
export class PaginationInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${PaginationInterceptor.name}`;

  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(TransactionRepository)
    protected transactionRepository: TransactionRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
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
    try {
      const methodName = invocationCtx.methodName as MethodType;
      const className = invocationCtx.targetClass.name as ControllerType;

      let args = invocationCtx.args;
      const filter = args[0] ? JSON.parse(args[0]) : args[0];

      let countResult = {count: 0};
      let page = 1;
      let sortBy = TimelineType.ALL;
      let userId = '';
      let q = '';
      let where = null;

      if (filter) {
        if (filter.where) {
          where = filter.where;

          if (filter.sortBy || filter.findBy) {
            throw new Error('ErrorWhere');
          }
        }

        // If sortBy and findBy exist
        // Filter for user timeline
        if (filter.sortBy || filter.findBy) {
          if (!filter.findBy) {
            throw new Error('EmptyFindBy');
          } else {
            userId = filter.findBy;
            delete filter.findBy;
          }

          if (!filter.sortBy) {
            const user = await this.userRepository.findById(userId);

            if (!user.onTimeline) sortBy = TimelineType.TRENDING;
            else sortBy = TimelineType.EXPERIENCE;
          } else {
            sortBy = filter.sortBy;
            delete filter.sortBy;
          }
        }

        if (filter.page) {
          page = filter.page;
          delete filter.page;
        }

        // Filter for search experience
        if (filter.q) {
          q = filter.q;
          delete filter.q;
        }
      }

      switch (methodName) {
        case MethodType.FIND: {
          const newFilter = defaultFilterQuery(page, filter);
          invocationCtx.args[0] = newFilter;

          args = [page, newFilter];
          countResult = await this.countTotal(className, where);

          break;
        }

        case MethodType.TIMELINE: {
          if (!where) where = await this.filterTimeline(userId, sortBy);

          const newFilter = defaultFilterQuery(page, filter, where);
          invocationCtx.args[0] = newFilter;

          args = [page, newFilter];
          countResult = await this.countTotal(className, where);

          break;
        }

        case MethodType.SEARCHEXPERIENCE: {
          if (!q) break;

          where = {
            name: new RegExp('^' + q, 'i'),
            origin: true,
          };

          const newFilter = defaultFilterQuery(page, filter, where);
          invocationCtx.args[0] = newFilter;

          args = [page, newFilter];
          countResult = await this.countTotal(className, where);

          break;
        }
      }

      const result = await next();

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
    } catch (err) {
      if (err.message === 'EmptyFindBy')
        throw new HttpErrors.UnprocessableEntity('FindBy cannot be empty');

      if (err.message === 'ErrorWhere')
        throw new HttpErrors.UnprocessableEntity('Where and (FindBy and SortBy) can not use both');

      throw new HttpErrors.UnprocessableEntity('Wrong filter format!');
    }
  }

  async filterTimeline(userId: string, sortBy: TimelineType): Promise<Where<Post> | null> {
    if (!userId) return null;

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
              importers: {
                inq: friends,
              },
            },
            {
              createdBy: {
                inq: friends,
              },
            },
          ],
        } as Where<Post>;
      }
    }

    if (!where) return null;

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

      case ControllerType.TAG:
        countResult = await this.tagRepository.count(where);
        break;

      case ControllerType.NOTIFICATION:
        countResult = await this.notificationRepository.count(where);
        break;

      case ControllerType.CURRENCY:
        countResult = await this.currencyRepository.count(where);
        break;

      case ControllerType.POSTCOMMENT:
        countResult = await this.commentRepository.count(where);
        break;

      case ControllerType.USERSOCIALMEDIA:
        countResult = await this.userSocialMediaRepository.count(where);
        break;

      default:
        countResult = {
          count: 0,
        };
    }

    return countResult;
  }
}
