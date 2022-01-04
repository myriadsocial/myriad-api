import {AuthenticationBindings} from '@loopback/authentication';
import {
  inject,
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  service,
  ValueOrPromise,
} from '@loopback/core';
import {AnyObject, Where, repository, Filter} from '@loopback/repository';
import {HttpErrors, RestBindings, Request} from '@loopback/rest';
import {
  ControllerType,
  FriendStatusType,
  MethodType,
  OrderFieldType,
  OrderType,
  TimelineType,
  VisibilityType,
} from '../enums';
import {
  Comment,
  Experience,
  Friend,
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
import {MetaPagination} from '../interfaces';
import {UserProfile, securityId} from '@loopback/security';

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
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    protected currentUser: UserProfile,
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
    if (!this.currentUser) throw new HttpErrors.Forbidden('Forbidden user!');

    const isUser = await this.userRepository.findOne({
      where: {id: this.currentUser[securityId]},
    });

    if (!isUser) {
      throw new HttpErrors.Forbidden('Forbidden user!');
    }

    const request = await invocationCtx.get(RestBindings.Http.REQUEST);
    const {pageNumber, pageLimit} = request.query;

    const filter = await this.beforePagination(invocationCtx, request);

    if (!filter) {
      return {
        data: [],
        meta: {
          totalItemCount: 0,
          totalPageCount: 0,
          itemsPerPage: 0,
        },
      };
    }

    const meta = await this.initializeMeta(invocationCtx, filter, [
      Number(pageNumber),
      Number(pageLimit),
    ]);

    const result = await next();

    const updatedResult = await this.afterPagination(
      invocationCtx,
      filter,
      request,
      result,
    );

    return {
      data: updatedResult,
      meta: meta,
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

  async beforePagination(
    invocationCtx: InvocationContext,
    request: Request,
  ): Promise<Filter<AnyObject> | void> {
    const {query, path} = request;
    const {userId, experienceId, timelineType, q} = query;

    const methodName = invocationCtx.methodName as MethodType;
    const controllerName = invocationCtx.targetClass.name as ControllerType;

    const filter =
      invocationCtx.args[0] && typeof invocationCtx.args[0] === 'object'
        ? invocationCtx.args[0]
        : {where: {}};

    filter.where = filter.where ?? {};

    switch (controllerName) {
      case ControllerType.DELETEDCOLLECTION: {
        filter.where = Object.assign(filter.where, {
          deletedAt: {$exists: true},
        });
        break;
      }

      // Use for search unblock user
      case ControllerType.USER: {
        if (methodName === MethodType.LEADERBOARD) {
          filter.fields = [
            'id',
            'name',
            'username',
            'profilePictureURL',
            'metric',
          ];
          break;
        }

        const blockedFriendIds = await this.friendService.getFriendIds(
          this.currentUser[securityId],
          FriendStatusType.BLOCKED,
        );

        filter.where = Object.assign(filter.where, {
          id: {
            nin: blockedFriendIds,
          },
        });

        break;
      }

      case ControllerType.REPORTUSER: {
        filter.include = ['reporter'];
        filter.order = this.orderSetting(query);
        filter.where = Object.assign(filter.where, {
          reportId: invocationCtx.args[0],
        });

        break;
      }

      // Set where filter when using timeline
      // Both Where filter and timeline cannot be used together
      case ControllerType.POST: {
        if (methodName === MethodType.TIMELINE) {
          // search post
          if (q) {
            const whereByQuery = await this.getPostByQuery(
              q.toString(),
              this.currentUser[securityId],
            );
            filter.where = Object.assign(filter.where ?? {}, whereByQuery);

            break;
          }

          // get timeline
          if (
            Object.keys(filter.where as Where<AnyObject>).length > 1 &&
            timelineType
          ) {
            throw new HttpErrors.UnprocessableEntity(
              'Where filter and timelineType can not be used at the same time!',
            );
          }

          if (timelineType) {
            if (!userId) return;
            const whereTimeline = await this.getTimeline(
              userId as string,
              timelineType as TimelineType,
              experienceId?.toString(),
            );

            if (!whereTimeline) return;

            filter.where = Object.assign(filter.where ?? {}, whereTimeline);
            filter.include = filter.include
              ? [...filter.include, 'user']
              : ['user'];
          }
        }

        if (methodName === MethodType.GETIMPORTERS) {
          const splitPath = path.split('/');
          const originPostId = splitPath[2];
          const platform = splitPath[4];

          filter.include = ['user'];
          filter.where = Object.assign(filter.where, {
            originPostId: originPostId,
            platform: platform,
          });
        }

        filter.order = this.orderSetting(query);

        break;
      }

      case ControllerType.EXPERIENCE: {
        if (q) {
          const whereExperience = await this.getExperienceByQuery(
            q.toString(),
            this.currentUser[securityId],
          );
          filter.where = Object.assign(filter.where ?? {}, whereExperience);
        }
        break
      }

      case ControllerType.FRIEND: {
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
          filter.where = Object.assign(filter.where ?? {}, {
            id: {inq: userIds},
          });
        }

        break;
      }
    }

    return filter;
  }

  async afterPagination(
    invocationCtx: InvocationContext,
    filter: Filter<AnyObject>,
    request: Request,
    result: AnyObject,
  ): Promise<AnyObject> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;
    const methodName = invocationCtx.methodName as MethodType;

    const {userId, experienceId, mutual} = request.query;

    switch (controllerName) {
      // include user in people field
      case ControllerType.USEREXPERIENCE: {
        if (Object.prototype.hasOwnProperty.call(filter.where, 'userId')) {
          result = this.experienceService.combinePeopleAndUser(
            result as UserExperienceWithRelations[],
          );
        }

        break;
      }

      case ControllerType.POST: {
        // include importers in post collection
        if (methodName === MethodType.TIMELINE) {
          result = await Promise.all(
            result.map(async (post: Post) =>
              this.postService.getPostImporterInfo(post, userId?.toString()),
            ),
          );

          if (experienceId) {
            await this.userRepository.updateById(userId?.toString() ?? '', {
              onTimeline: experienceId.toString(),
            });
          }
        }

        // rename importers detail
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
                if (this.currentUser[securityId] === e.createdBy) return e.user;
                const friend =
                  await this.friendService.friendRepository.findOne({
                    where: {
                      requestorId: this.currentUser[securityId],
                      requesteeId: e.createdBy,
                    },
                  });

                if (friend) return e.user;

                return Object.assign(e.user, {
                  name: 'Unknown Myrian',
                  username: 'Unknown Myrian',
                });
              }

              return e.user;
            }),
          );
        }
        break;
      }

      // include total mutual friend in friend collection
      case ControllerType.FRIEND: {
        if (mutual === 'true') {
          const where = JSON.stringify(filter.where);

          if (where.match(/approved/gi) || where.match(/pending/gi)) {
            result = await Promise.all(
              result.map(async (friend: Friend) => {
                const {requestorId, requesteeId} = friend;
                const {count: totalMutual} =
                  await this.friendService.countMutual(
                    requestorId,
                    requesteeId,
                  );

                return Object.assign(friend, {totalMutual: totalMutual});
              }),
            );
          }
        }

        break;
      }

      // Changed comment text to [comment removed] when comment is deleted
      case ControllerType.COMMENT: {
        result = result.map((comment: Comment) => {
          if (comment.deletedAt) comment.text = '[comment removed]';
          return comment;
        });

        break;
      }

      // Changed user name and username to [user banned] when user is deleted
      case ControllerType.USER: {
        result = result.map((user: User) => {
          if (user.deletedAt) {
            user.name = '[user banned]';
            user.username = '[user banned]';
          }
          return user;
        });

        break;
      }
    }

    return result;
  }

  async initializeMeta(
    invocationCtx: InvocationContext,
    filter: Filter<AnyObject>,
    pageDetail: number[],
  ): Promise<MetaPagination> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;
    const methodName = invocationCtx.methodName as MethodType;

    const {count} = await this.metricService.countData(
      controllerName,
      methodName,
      filter.where as Where<AnyObject>,
    );

    const paginationFilter = Object.assign(filter, {
      offset: (pageDetail[0] - 1) * pageDetail[1],
      limit: pageDetail[1],
    });

    if (controllerName === ControllerType.REPORTUSER)
      invocationCtx.args[1] = paginationFilter;
    else invocationCtx.args[0] = paginationFilter;

    return pageMetadata([...pageDetail, count]);
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
    const friendUserIds = users
      .filter(user => approvedFriendIds.includes(user.id))
      .map(e => e.id);
    const publicUserIds = users
      .filter(user => !approvedFriendIds.includes(user.id))
      .map(e => e.id);
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
}
