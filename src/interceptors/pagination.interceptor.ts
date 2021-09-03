import {
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  service,
  ValueOrPromise,
} from '@loopback/core';
import {Where} from '@loopback/repository';
import {HttpErrors, RestBindings} from '@loopback/rest';
import {CommentType, ControllerType, MethodType, TimelineType} from '../enums';
import {Post} from '../models';
import {
  ExperienceService,
  FriendService,
  MetricService,
  NotificationService,
  TagService,
} from '../services';
import {pageMetadata} from '../utils/page-metadata.utils';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: PaginationInterceptor.BINDING_KEY}})
export class PaginationInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${PaginationInterceptor.name}`;

  constructor(
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
    const {query} = await invocationCtx.get(RestBindings.Http.REQUEST);
    const {pageNumber, pageLimit, userId, timelineType} = query;
    const methodName = invocationCtx.methodName as MethodType;
    const className = invocationCtx.targetClass.name as ControllerType;

    let filter = null;

    if (ControllerType.POSTCOMMENT || ControllerType.COMMENTCOMMENT) {
      filter = invocationCtx.args[1] ?? {where: {}};
    } else {
      filter = invocationCtx.args[0] ?? {where: {}};
    }

    if (methodName === MethodType.TIMELINE) {
      if (filter.where && Object.keys(filter.where).length > 0 && timelineType)
        throw new HttpErrors.UnprocessableEntity(
          'Where filter and timelineType can not be used at the same time!',
        );

      if (timelineType) {
        if (!userId) throw new HttpErrors.UnprocessableEntity('UserId must be filled');

        const where = await this.getTimeline(userId as string, timelineType as TimelineType);

        if (where) filter.where = where;
        else
          return {
            data: [],
            meta: pageMetadata(NaN, NaN, 0),
          };
      }
    }

    let pageIndex = 1;
    let pageSize = 5;

    if (!isNaN(Number(pageNumber)) || Number(pageNumber) > 0) pageIndex = Number(pageNumber);
    if (!isNaN(Number(pageLimit)) || Number(pageLimit) > 0) pageSize = Number(pageLimit);

    if (className === ControllerType.POSTCOMMENT || className === ControllerType.COMMENTCOMMENT) {
      invocationCtx.args[1] = Object.assign(filter, {
        limit: pageSize,
        offset: (pageIndex - 1) * pageSize,
      });

      const type =
        className === ControllerType.POSTCOMMENT ? CommentType.POST : CommentType.COMMENT;

      filter.where = Object.assign(filter.where, {
        referenceId: invocationCtx.args[0],
        type: type,
      });
    } else {
      invocationCtx.args[0] = Object.assign(filter, {
        limit: pageSize,
        offset: (pageIndex - 1) * pageSize,
      });
    }

    const result = await next();
    const {count} = await this.metricService.countData(className, filter.where);

    if (className === ControllerType.NOTIFICATION && methodName === MethodType.FIND) {
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
      meta: pageMetadata(pageIndex, pageSize, count),
    };
  }

  async getTimeline(userId: string, timelineType: TimelineType): Promise<Where<Post> | undefined> {
    switch (timelineType) {
      case TimelineType.EXPERIENCE:
        return this.experienceService.experienceTimeline(userId);

      case TimelineType.TRENDING:
        return this.tagService.trendingTimeline();

      case TimelineType.FRIEND:
        return this.friendService.friendsTimeline(userId);

      case TimelineType.ALL: {
        const approvedFriendIds = await this.friendService.getApprovedFriendIds(userId);
        const trendingTopics = await this.tagService.trendingTopics();

        const experience = await this.experienceService.getExperience(userId);
        const experienceTopics = experience ? experience.tags : [];
        const experiencePersonIds = experience ? experience.people.map(e => e.id) : [];

        const friends = [...approvedFriendIds, userId];
        const topics = [...trendingTopics, ...experienceTopics];
        const personIds = experiencePersonIds;

        if (!friends.length && !topics.length && !personIds.length) return;

        const joinTopics = topics.join('|');
        const regexTopic = new RegExp(joinTopics, 'i');

        return {
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
  }
}
