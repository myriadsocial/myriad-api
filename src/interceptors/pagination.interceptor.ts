import {
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  service,
  ValueOrPromise,
} from '@loopback/core';
import {AnyObject, Where, repository} from '@loopback/repository';
import {HttpErrors, RestBindings} from '@loopback/rest';
import {
  ControllerType,
  FriendStatusType,
  MethodType,
  OrderFieldType,
  OrderType,
  TimelineType,
  VisibilityType,
} from '../enums';
import {Post} from '../models';
import {
  ExperienceService,
  FriendService,
  MetricService,
  NotificationService,
  TagService,
} from '../services';
import {pageMetadata} from '../utils/page-metadata.utils';
import {FriendRepository, UserRepository} from '../repositories';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: PaginationInterceptor.BINDING_KEY}})
export class PaginationInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${PaginationInterceptor.name}`;

  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
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
  async intercept(
    invocationCtx: InvocationContext,
    next: () => ValueOrPromise<InvocationResult>,
  ) {
    const {query} = await invocationCtx.get(RestBindings.Http.REQUEST);
    const {pageNumber, pageLimit, userId, timelineType, q} = query;
    const methodName = invocationCtx.methodName as MethodType;
    const className = invocationCtx.targetClass.name as ControllerType;
    const filter =
      invocationCtx.args[0] && typeof invocationCtx.args[0] === 'object'
        ? invocationCtx.args[0]
        : {where: {}};

    filter.where = filter.where ?? {};

    if (className === ControllerType.DELETEDCOLLECTIONCONTROLLER) {
      filter.where = Object.assign(filter.where, {deletedAt: {$exists: true}});
    }

    // Set filter for user
    // Use for search unblock user
    if (className === ControllerType.USER && userId) {
      const blockedFriendIds = await this.friendService.getFriendIds(
        userId.toString(),
        FriendStatusType.BLOCKED,
      );

      filter.where = Object.assign(filter.where, {
        id: {
          nin: blockedFriendIds,
        },
      });
    }

    if (className === ControllerType.REPORTUSERCONTROLLER) {
      filter.where = {
        reportId: invocationCtx.args[0],
      };
    }

    // Set filter for blocked friend
    if (
      className === ControllerType.FRIEND &&
      methodName === MethodType.FINDBLOCKEDFRIEND
    ) {
      filter.where = Object.assign(filter.where, {
        requestorId: userId ?? undefined,
        status: FriendStatusType.BLOCKED,
      });
    }

    if (className === ControllerType.POST && q) {
      const whereByQuery = await this.getPostByQuery(q.toString());
      filter.where = Object.assign(filter.where ?? {}, whereByQuery);
    }

    // Set where filter when using timeline
    // Both Where filter and timeline cannot be used together
    if (
      className === ControllerType.POST &&
      methodName === MethodType.TIMELINE
    ) {
      if (Object.keys(filter.where).length > 1 && timelineType)
        throw new HttpErrors.UnprocessableEntity(
          'Where filter and timelineType can not be used at the same time!',
        );

      if (timelineType) {
        if (!userId)
          throw new HttpErrors.UnprocessableEntity('UserId must be filled');

        filter.order = this.orderSetting(query);

        const whereTimeline = await this.getTimeline(
          userId as string,
          timelineType as TimelineType,
        );

        if (whereTimeline)
          filter.where = Object.assign(filter.where ?? {}, whereTimeline);
        else {
          return {
            data: [],
            meta: pageMetadata(NaN, NaN, 0),
          };
        }
      }
    }

    // Get pageMetadata
    const {count} = await this.metricService.countData(
      className,
      methodName,
      filter.where,
    );
    const {pageIndex, pageSize} = this.pageSetting(
      Number(pageNumber),
      Number(pageLimit),
    );
    const meta = pageMetadata(pageIndex, pageSize, count);

    // Reassign filter object
    if (className === ControllerType.REPORTUSERCONTROLLER) {
      invocationCtx.args[1] = Object.assign(filter, {
        limit: pageSize,
        offset: (pageIndex - 1) * pageSize,
      });
    } else {
      invocationCtx.args[0] = Object.assign(filter, {
        limit: pageSize,
        offset: (pageIndex - 1) * pageSize,
      });
    }

    const result = await next();

    // Set notification has been read
    if (
      className === ControllerType.NOTIFICATION &&
      methodName === MethodType.FIND
    ) {
      const notificationFilter = invocationCtx.args[0];
      const toUser = notificationFilter.where
        ? notificationFilter.where.to
          ? notificationFilter.where.to
          : null
        : null;

      await this.notificationService.readNotification(toUser);
    }

    return {
      data: result,
      meta: meta,
    };
  }

  pageSetting(pageNumber: number, pageLimit: number) {
    let pageIndex = 1;
    let pageSize = 5;

    if (!isNaN(pageNumber) || pageNumber > 0) pageIndex = pageNumber;
    if (!isNaN(pageLimit) || pageLimit > 0) pageSize = pageLimit;

    return {
      pageIndex,
      pageSize,
    };
  }

  orderSetting(query: AnyObject): string[] {
    let {sortBy, order} = query;

    switch (sortBy) {
      case OrderFieldType.POPULAR:
        sortBy = 'popularCount';
        break;

      case OrderFieldType.UPVOTE:
        sortBy = 'metric.upvote';
        break;

      case OrderFieldType.COMMENT:
        sortBy = 'metric.comment';
        break;

      case OrderFieldType.LATEST:
        sortBy = 'createdAt';
        break;

      default:
        sortBy = 'createdAt';
    }

    if (!order) order = OrderType.DESC;
    return [sortBy + ' ' + order];
  }

  async getPostByQuery(q: string): Promise<Where<Post>> {
    const pattern = new RegExp(q, 'i');
    const users = await this.userRepository.find({
      where: {
        or: [
          {
            name: {
              regexp: pattern,
            },
          },
          {
            username: {
              regexp: pattern,
            },
          },
        ],
      },
    });
    const userIds = users.map(user => user.id);
    return {
      or: [
        {
          and: [
            {
              createdBy: {
                inq: userIds,
              },
            },
            {
              visibility: VisibilityType.PUBLIC,
            },
          ],
        },
        {
          and: [
            {
              importers: {
                inq: userIds,
              },
            },
            {
              visibility: VisibilityType.PUBLIC,
            },
          ],
        },
        {
          and: [
            {
              text: {
                regexp: pattern,
              },
            },
            {
              visibility: VisibilityType.PUBLIC,
            },
          ],
        },
        {
          and: [
            {
              title: {
                regexp: pattern,
              },
            },
            {
              visibility: VisibilityType.PUBLIC,
            },
          ],
        },
      ],
    } as Where<Post>;
  }

  async getTimeline(
    userId: string,
    timelineType: TimelineType,
  ): Promise<Where<Post> | undefined> {
    switch (timelineType) {
      case TimelineType.EXPERIENCE:
        return this.experienceService.experienceTimeline(userId);

      case TimelineType.TRENDING:
        return this.tagService.trendingTimeline();

      case TimelineType.FRIEND:
        return this.friendService.friendsTimeline(userId);

      case TimelineType.ALL: {
        const approvedFriendIds = await this.friendService.getFriendIds(
          userId,
          FriendStatusType.APPROVED,
        );
        const trendingTopics = await this.tagService.trendingTopics();

        const experience = await this.experienceService.getExperience(userId);
        const experienceTopics = experience ? experience.tags : [];
        const experiencePersonIds = experience
          ? experience.people.map(e => e.id)
          : [];

        const friends = [...approvedFriendIds, userId];
        const topics = [...trendingTopics, ...experienceTopics];
        const personIds = experiencePersonIds;

        if (!friends.length && !topics.length && !personIds.length) return;

        const joinTopics = topics.join('|');
        const regexTopic = new RegExp(joinTopics, 'i');

        return {
          or: [
            {
              and: [
                {
                  tags: {
                    inq: topics,
                  },
                },
                {
                  visibility: VisibilityType.PUBLIC,
                },
              ],
            },
            {
              and: [
                {
                  title: regexTopic,
                },
                {
                  visibility: VisibilityType.PUBLIC,
                },
              ],
            },
            {
              and: [
                {
                  text: regexTopic,
                },
                {
                  visibility: VisibilityType.PUBLIC,
                },
              ],
            },
            {
              and: [
                {
                  peopleId: {
                    inq: personIds,
                  },
                },
                {
                  visibility: VisibilityType.PUBLIC,
                },
              ],
            },
            {
              and: [
                {
                  importers: {
                    inq: friends,
                  },
                },
                {
                  visibility: VisibilityType.PUBLIC,
                },
              ],
            },
            {
              and: [
                {
                  createdBy: {
                    inq: friends,
                  },
                },
                {
                  visibility: VisibilityType.PUBLIC,
                },
              ],
            },
            {createdBy: userId},
          ],
        } as Where<Post>;
      }
    }
  }
}
