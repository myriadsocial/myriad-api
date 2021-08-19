import {
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  service,
  ValueOrPromise,
} from '@loopback/core';
import {repository, Where} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {ControllerType, MethodType, TimelineType} from '../enums';
import {Post} from '../models';
import {UserRepository} from '../repositories';
import {
  ExperienceService,
  FriendService,
  MetricService,
  NotificationService,
  TagService,
} from '../services';
import {defaultFilterQuery, noneStatusFiltering} from '../utils/filter-utils';
import {pageMetadata} from '../utils/page-metadata.utils';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
// @injectable({tags: {key: PaginationInterceptor.BINDING_KEY}})

@injectable({tags: {key: PaginationInterceptor.BINDING_KEY}})
export class PaginationInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${PaginationInterceptor.name}`;

  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @service(MetricService)
    protected metricService: MetricService,
    @service(ExperienceService)
    protected experienceService: ExperienceService,
    @service(TagService)
    protected tagService: TagService,
    @service(FriendService)
    protected friendService: FriendService,
    @service(NotificationService)
    protected notificationService: NotificationService,
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

      let data = {count: 0};
      let page = 1;
      let sortBy = null;
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

          if (methodName === MethodType.TIMELINE) {
            if (!filter.sortBy) {
              const user = await this.userRepository.findById(userId);

              if (!user.onTimeline) sortBy = TimelineType.TRENDING;
              else sortBy = TimelineType.EXPERIENCE;
            } else {
              sortBy = filter.sortBy;
              delete filter.sortBy;
            }
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

      args = [page];

      switch (methodName) {
        case MethodType.FIND: {
          const newFilter = defaultFilterQuery(page, filter);
          invocationCtx.args[0] = newFilter;

          args.push(newFilter);
          data = await this.metricService.countData(className, where);

          break;
        }

        case MethodType.TIMELINE: {
          if (!where) where = await this.filterTimeline(userId, sortBy);
          if (!where && sortBy) break;

          const newFilter = defaultFilterQuery(page, filter, where);
          invocationCtx.args[0] = newFilter;

          args.push(newFilter);
          data = await this.metricService.countData(className, where);

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

          args.push(newFilter);
          data = await this.metricService.countData(className, where);

          break;
        }

        default:
          args = [];
      }

      const result = await next();

      if (className === ControllerType.NOTIFICATION && methodName === MethodType.FIND) {
        const notificationFilter = invocationCtx.args[0];
        const toUser = notificationFilter.where
          ? notificationFilter.where.to
            ? notificationFilter.where.to
            : null
          : null;

        this.notificationService.readNotification(toUser) as Promise<void>;
      }

      return {
        data: result,
        meta: pageMetadata(args, data.count),
      };
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
}
