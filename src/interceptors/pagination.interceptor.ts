import {
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  service,
  ValueOrPromise,
} from '@loopback/core';
import {AnyObject, Where, repository, Count} from '@loopback/repository';
import {HttpErrors, RestBindings} from '@loopback/rest';
import {
  ControllerType,
  FriendStatusType,
  MethodType,
  OrderFieldType,
  OrderType,
  PlatformType,
  TimelineType,
  VisibilityType,
} from '../enums';
import {
  Comment,
  Experience,
  Friend,
  LeaderBoardWithRelations,
  People,
  Post,
  PostWithRelations,
  User,
  UserExperienceWithRelations,
} from '../models';
import {
  ExperienceService,
  FriendService,
  MetricService,
  NotificationService,
  PostService,
  TagService,
} from '../services';
import {pageMetadata} from '../utils/page-metadata.utils';
import {UserRepository} from '../repositories';

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
    @service(PostService)
    protected postService: PostService,
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
    const {query, path} = await invocationCtx.get(RestBindings.Http.REQUEST);
    const {
      pageNumber,
      pageLimit,
      userId,
      experienceId,
      timelineType,
      mutual,
      q,
    } = query;
    const methodName = invocationCtx.methodName as MethodType;
    const className = invocationCtx.targetClass.name as ControllerType;
    const filter =
      invocationCtx.args[0] && typeof invocationCtx.args[0] === 'object'
        ? invocationCtx.args[0]
        : {where: {}};

    filter.where = filter.where ?? {};

    if (className === ControllerType.DELETEDCOLLECTION) {
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

    if (className === ControllerType.REPORTUSER) {
      filter.include = ['reporter'];
      filter.order = this.orderSetting(query);
      filter.where = Object.assign(filter.where, {
        reportId: invocationCtx.args[0],
      });
    }

    if (className === ControllerType.LEADERBOARD) {
      filter.include = ['user'];
    }

    // Set where filter when using timeline
    // Both Where filter and timeline cannot be used together
    if (className === ControllerType.POST) {
      if (q) {
        const whereByQuery = await this.getPostByQuery(
          q.toString(),
          userId?.toString(),
        );
        filter.where = Object.assign(filter.where ?? {}, whereByQuery);
      }

      switch (methodName) {
        case MethodType.TIMELINE: {
          if (Object.keys(filter.where).length > 1 && timelineType) {
            throw new HttpErrors.UnprocessableEntity(
              'Where filter and timelineType can not be used at the same time!',
            );
          }

          if (timelineType) {
            if (!userId)
              throw new HttpErrors.UnprocessableEntity('UserId must be filled');

            const whereTimeline = await this.getTimeline(
              userId as string,
              timelineType as TimelineType,
              experienceId?.toString(),
            );

            if (whereTimeline) {
              filter.where = Object.assign(filter.where ?? {}, whereTimeline);
              filter.include = filter.include
                ? [...filter.include, 'user']
                : ['user'];
            } else {
              return {
                data: [],
                meta: pageMetadata(NaN, NaN, 0),
              };
            }
          }

          break;
        }

        case MethodType.GETIMPORTERS: {
          const splitPath = path.split('/');
          const originPostId = splitPath[2];
          const platform = splitPath[4];

          filter.include = ['user'];
          filter.where = Object.assign(filter.where, {
            originPostId: originPostId,
            platform: platform,
          });

          break;
        }
      }

      filter.order = this.orderSetting(query);
    }

    if (className === ControllerType.EXPERIENCE) {
      if (q) {
        const whereExperience = await this.getExperienceByQuery(
          q.toString(),
          userId?.toString(),
        );

        filter.where = Object.assign(filter.where ?? {}, whereExperience);
      }
    }

    if (methodName === MethodType.MUTUALDETAIL) {
      const mutualPath = path.split('/');
      const requestorId = mutualPath[2];
      const requesteeId = mutualPath[4];
      /* eslint-disable  @typescript-eslint/no-explicit-any */
      const collection = (
        this.friendService.friendRepository.dataSource.connector as any
      ).collection(Friend.modelName);

      const userIds = (
        await collection
          .aggregate([
            {
              $match: {
                $or: [
                  {
                    requestorId: requestorId,
                    status: FriendStatusType.APPROVED,
                  },
                  {
                    requestorId: requesteeId,
                    status: FriendStatusType.APPROVED,
                  },
                ],
              },
            },
            {$group: {_id: '$requesteeId', count: {$sum: 1}}},
            {$match: {count: 2}},
            {$project: {_id: 1}},
          ])
          .get()
      ).map((user: AnyObject) => user._id);

      filter.order = this.orderSetting(query);
      filter.where = Object.assign(filter.where ?? {}, {id: {inq: userIds}});
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

    const paginationFilter = Object.assign(filter, {
      limit: pageSize,
      offset: (pageIndex - 1) * pageSize,
    });

    // Reassign filter object
    if (className === ControllerType.REPORTUSER)
      invocationCtx.args[1] = paginationFilter;
    else invocationCtx.args[0] = paginationFilter;

    let result = await next();

    if (
      className === ControllerType.USEREXPERIENCE &&
      Object.prototype.hasOwnProperty.call(filter.where, 'userId')
    ) {
      result = this.combinePeopleAndUser(result);
    }

    if (className === ControllerType.POST) {
      if (methodName === MethodType.TIMELINE) {
        result = await Promise.all(
          result.map(async (post: Post) =>
            this.postService.getPostImporterInfo(post, userId?.toString()),
          ),
        );
      }

      if (methodName === MethodType.GETIMPORTERS) {
        result = await Promise.all(
          result.map(async (e: PostWithRelations) => {
            if (e.visibility === VisibilityType.PRIVATE) {
              return Object.assign(e.user, {
                name: 'Unknown Myrian',
                username: 'Unknown Myrian',
              });
            }

            if (e.visibility === VisibilityType.FRIEND) {
              if (userId) {
                if (userId === e.createdBy) return e.user;
                const friend =
                  await this.friendService.friendRepository.findOne({
                    where: {
                      requestorId: userId.toString(),
                      requesteeId: e.createdBy,
                    },
                  });

                if (friend) return e.user;
              }

              return Object.assign(e.user, {
                name: 'Unknown Myrian',
                username: 'Unknown Myrian',
              });
            }

            return e.user;
          }),
        );
      }

      if (experienceId) {
        await this.userRepository.updateById(userId?.toString() ?? '', {
          onTimeline: experienceId.toString(),
        });
      }
    }

    if (className === ControllerType.FRIEND && mutual === 'true') {
      const where = JSON.stringify(filter.where);

      if (where.match(/approved/gi) || where.match(/pending/gi)) {
        result = await Promise.all(
          result.map(async (friend: Friend) => {
            const {requestorId, requesteeId} = friend;
            const {count: totalMutual} = await this.countMutual(
              requestorId,
              requesteeId,
            );

            return Object.assign(friend, {totalMutual: totalMutual});
          }),
        );
      }
    }

    if (className === ControllerType.COMMENT) {
      result = result.map((comment: Comment) => {
        if (comment.deletedAt) comment.text = '[comment removed]';
        return comment;
      });
    }

    if (className === ControllerType.USER) {
      result = result.map((user: User) => {
        if (user.deletedAt) {
          user.name = '[user banned]';
          user.username = '[user banned]';
        }
        return user;
      });
    }

    if (className === ControllerType.LEADERBOARD) {
      result = result.map((e: LeaderBoardWithRelations) => {
        const totalActivity = e.totalActivity;

        if (e.user?.metric) {
          e.user.metric.totalActivity = totalActivity;
        }

        return e.user;
      });
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
        sortBy = 'metric.upvotes';
        break;

      case OrderFieldType.COMMENT:
        sortBy = 'metric.comments';
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

  async getPostByQuery(q: string, userId?: string): Promise<Where<Post>> {
    let blockedFriendIds: string[] = [];
    let approvedFriendIds: string[] = [];

    if (userId) {
      blockedFriendIds = await this.friendService.getFriendIds(
        userId,
        FriendStatusType.BLOCKED,
      );

      approvedFriendIds = await this.friendService.getFriendIds(
        userId,
        FriendStatusType.APPROVED,
      );
      approvedFriendIds = [...approvedFriendIds, userId];
    }

    const pattern = new RegExp(q, 'i');
    const users = await this.userRepository.find({
      where: {
        or: [
          {
            and: [{name: {regexp: pattern}}, {id: {nin: blockedFriendIds}}],
          },
          {
            and: [{username: {regexp: pattern}}, {id: {nin: blockedFriendIds}}],
          },
          {
            and: [
              {username: {regexp: pattern}},
              {id: {inq: approvedFriendIds}},
            ],
          },
          {
            and: [{name: {regexp: pattern}}, {id: {inq: approvedFriendIds}}],
          },
        ],
      },
    });
    const friendUserIds = users.filter(user =>
      approvedFriendIds.includes(user.id),
    );
    const publicUserIds = users.filter(
      user => !approvedFriendIds.includes(user.id),
    );
    const regexTopic = new RegExp(` ${q}"|"${q} |"${q}"| ${q} `, 'i');
    return {
      or: [
        {
          and: [
            {createdBy: {inq: publicUserIds}},
            {visibility: VisibilityType.PUBLIC},
          ],
        },
        {
          and: [
            {createdBy: {inq: friendUserIds}},
            {visibility: VisibilityType.FRIEND},
          ],
        },
        {
          and: [
            {text: {regexp: regexTopic}},
            {visibility: VisibilityType.PUBLIC},
            {createdBy: {nin: blockedFriendIds}},
          ],
        },
        {
          and: [
            {title: {regexp: regexTopic}},
            {visibility: VisibilityType.PUBLIC},
            {createdBy: {nin: blockedFriendIds}},
          ],
        },
        {
          and: [
            {tags: {inq: [q.replace(/%23/gi, '').trim()]}},
            {visibility: VisibilityType.PUBLIC},
            {createdBy: {nin: blockedFriendIds}},
          ],
        },
        {
          and: [
            {text: {regexp: regexTopic}},
            {visibility: VisibilityType.FRIEND},
            {createdBy: {inq: approvedFriendIds}},
          ],
        },
        {
          and: [
            {title: {regexp: regexTopic}},
            {visibility: VisibilityType.FRIEND},
            {createdBy: {inq: approvedFriendIds}},
          ],
        },
        {
          and: [
            {tags: {inq: [q.replace(/%23/gi, '').trim()]}},
            {visibility: VisibilityType.FRIEND},
            {createdBy: {inq: approvedFriendIds}},
          ],
        },
      ],
    } as Where<Post>;
  }

  async getExperienceByQuery(
    q: string,
    userId?: string,
  ): Promise<Where<Experience>> {
    let blockedFriendIds: string[] = [];

    if (userId) {
      blockedFriendIds = await this.friendService.getFriendIds(
        userId,
        FriendStatusType.BLOCKED,
      );
    }

    const pattern = new RegExp(q, 'i');

    return {
      and: [{name: {regexp: pattern}}, {createdBy: {nin: blockedFriendIds}}],
    } as Where<Experience>;
  }

  async getTimeline(
    userId: string,
    timelineType: TimelineType,
    experienceId?: string,
  ): Promise<Where<Post> | undefined> {
    switch (timelineType) {
      case TimelineType.EXPERIENCE:
        return this.experienceService.experienceTimeline(userId, experienceId);

      case TimelineType.TRENDING:
        return this.tagService.trendingTimeline(userId);

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
        const experienceUserIds = experience
          ? (experience.users ?? []).map(e => e.id)
          : [];
        const blockedFriendIds = await this.friendService.getFriendIds(
          userId,
          FriendStatusType.BLOCKED,
        );

        const friends = [...approvedFriendIds, userId];
        const topics = [...trendingTopics, ...experienceTopics];
        const personIds = experiencePersonIds;

        if (!friends.length && !topics.length && !personIds.length) return;

        return {
          or: [
            {
              and: [
                {tags: {inq: topics}},
                {createdBy: {nin: blockedFriendIds}},
                {visibility: VisibilityType.PUBLIC},
              ],
            },
            {
              and: [
                {peopleId: {inq: personIds}},
                {createdBy: {nin: blockedFriendIds}},
                {visibility: VisibilityType.PUBLIC},
              ],
            },
            {
              and: [
                {createdBy: {inq: [...friends, ...experienceUserIds]}},
                {visibility: VisibilityType.PUBLIC},
              ],
            },
            {
              and: [
                {createdBy: {inq: friends}},
                {visibility: VisibilityType.FRIEND},
              ],
            },
            {createdBy: userId},
          ],
        } as Where<Post>;
      }
    }
  }

  async countMutual(requestorId: string, requesteeId: string): Promise<Count> {
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    const collection = (
      this.friendService.friendRepository.dataSource.connector as any
    ).collection(Friend.modelName);

    const countMutual = await collection
      .aggregate([
        {
          $match: {
            $or: [
              {
                requestorId: requestorId,
                status: FriendStatusType.APPROVED,
              },
              {
                requestorId: requesteeId,
                status: FriendStatusType.APPROVED,
              },
            ],
          },
        },
        {$group: {_id: '$requesteeId', count: {$sum: 1}}},
        {$match: {count: 2}},
        {$group: {_id: null, count: {$sum: 1}}},
        {$project: {_id: 0}},
      ])
      .get();

    if (countMutual.length === 0) return {count: 0};
    return countMutual[0];
  }

  combinePeopleAndUser(
    result: UserExperienceWithRelations[],
  ): UserExperienceWithRelations[] {
    return result.map((userExperience: UserExperienceWithRelations) => {
      const users = userExperience.experience?.users;

      if (!users) return userExperience;

      const newExperience: Partial<Experience> = {
        ...userExperience.experience,
      };

      delete newExperience.users;

      const userToPeople = users.map(user => {
        return new People({
          id: user.id,
          name: user.name,
          username: user.username,
          platform: PlatformType.MYRIAD,
          originUserId: user.id,
          profilePictureURL: user.profilePictureURL,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        });
      });

      const people = userExperience.experience?.people ?? [];

      newExperience.people = [...userToPeople, ...people];
      userExperience.experience = newExperience as Experience;

      return userExperience;
    });
  }
}
