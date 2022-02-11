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
  AccountSettingType,
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
  Post,
  PostWithRelations,
  User,
  UserExperienceWithRelations,
} from '../models';
import {
  ExperienceService,
  FriendService,
  MetricService,
  PostService,
  TagService,
} from '../services';
import {pageMetadata} from '../utils/page-metadata.utils';
import {AccountSettingRepository, UserRepository} from '../repositories';
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
    @repository(AccountSettingRepository)
    protected accountSettingRepository: AccountSettingRepository,
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
    const methodName = invocationCtx.methodName as MethodType;
    const controllerName = invocationCtx.targetClass.name as ControllerType;

    const filter =
      invocationCtx.args[0] && typeof invocationCtx.args[0] === 'object'
        ? invocationCtx.args[0]
        : {where: {}};

    filter.where = filter.where ?? {};

    switch (controllerName) {
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
          true,
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
        filter.order = this.orderSetting(request.query);
        filter.where = Object.assign(filter.where, {
          reportId: invocationCtx.args[0],
        });

        break;
      }

      // Set where filter when using timeline
      // Both Where filter and timeline cannot be used together
      case ControllerType.POST: {
        if (methodName === MethodType.TIMELINE) {
          const {experienceId, timelineType, q, topic} = request.query;

          if (
            (q && (topic || timelineType)) ||
            (topic && (q || timelineType)) ||
            (timelineType && (q || topic))
          ) {
            if (Object.keys(filter.where as Where<AnyObject>).length > 1) {
              throw new HttpErrors.UnprocessableEntity(
                'Cannot used where filter together with q, topic, and timelineType',
              );
            }

            throw new HttpErrors.UnprocessableEntity(
              'Cannot used q, topic, and timelineType at the same time',
            );
          }

          // search post
          if (!q && typeof q === 'string') return;
          if (q) {
            let postQuery = q.toString();
            if (postQuery.length === 1 && !postQuery.match('^[A-Za-z0-9]'))
              return;
            if (postQuery.length > 1) {
              if (postQuery[0] === '@' || postQuery[0] === '#') {
                const re =
                  postQuery[0] === '@'
                    ? new RegExp('[^A-Za-z0-9 _]', 'gi')
                    : new RegExp('[^A-Za-z0-9]', 'gi');
                postQuery = postQuery[0] + postQuery.replace(re, '');
              } else {
                postQuery.replace(new RegExp('[^A-Za-z0-9 ]', 'gi'), '');
              }
            }

            filter.where = await this.getPostByQuery(postQuery.trim());

            break;
          }

          // search topic
          if (!topic && typeof topic === 'string') return;
          if (topic) {
            filter.where = await this.getTopicByQuery(topic.toString());
          }

          // get timeline
          if (!timelineType && typeof timelineType === 'string') return;
          if (timelineType) {
            const whereTimeline = await this.getTimeline(
              timelineType as TimelineType,
              experienceId?.toString(),
            );

            filter.where = whereTimeline ?? {id: ''};
          }

          filter.include = filter.include
            ? [...filter.include, 'user']
            : ['user'];
        }

        if (methodName === MethodType.GETIMPORTERS) {
          const splitPath = request.path.split('/');
          const originPostId = splitPath[2];
          const platform = splitPath[4];

          filter.include = ['user'];
          filter.where = Object.assign(filter.where, {
            originPostId: originPostId,
            platform: platform,
          });
        }

        filter.order = this.orderSetting(request.query);

        break;
      }

      case ControllerType.EXPERIENCE: {
        const {q} = request.query;

        // search experience
        if (!q && typeof q === 'string') return;
        if (q) {
          let experienceQuery = q.toString();
          if (
            experienceQuery.length === 1 &&
            !experienceQuery.match('^[A-Za-z0-9]')
          )
            return;
          if (experienceQuery.length > 1) {
            experienceQuery = experienceQuery.replace(
              new RegExp('[^A-Za-z0-9]', 'gi'),
              '',
            );
          }

          filter.where = await this.getExperienceByQuery(experienceQuery);
        }
        break;
      }

      case ControllerType.FRIEND: {
        if (methodName === MethodType.MUTUALDETAIL) {
          const mutualPath = request.path.split('/');
          const requestorId = mutualPath[2];
          const requesteeId = mutualPath[4];
          const userIds = this.friendService.getMutualUserIds(
            requestorId,
            requesteeId,
          );

          filter.order = this.orderSetting(request.query);
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
              this.postService.getPostImporterInfo(
                post,
                this.currentUser[securityId],
              ),
            ),
          );

          if (request.query.experienceId) {
            const {count} =
              await this.experienceService.userExperienceRepository.count({
                userId: this.currentUser[securityId],
                experienceId: request.query.experienceId.toString(),
              });

            if (count === 1) {
              await this.userRepository.updateById(
                this.currentUser[securityId],
                {
                  onTimeline: request.query.experienceId.toString(),
                },
              );
            }
          }
        }

        // rename importers detail
        if (methodName === MethodType.GETIMPORTERS) {
          result = (
            await Promise.all(
              result.map(async (e: PostWithRelations) => {
                if (e.visibility === VisibilityType.PRIVATE) {
                  return Object.assign(e.user, {
                    name: 'Unknown Myrian',
                    username: 'Unknown Myrian',
                  });
                }

                if (e.visibility === VisibilityType.FRIEND) {
                  if (this.currentUser[securityId] === e.createdBy)
                    return e.user;
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
            )
          ).filter(e => e);
        }
        break;
      }

      // include total mutual friend in friend collection
      case ControllerType.FRIEND: {
        if (request.query.mutual === 'true') {
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
        result = await Promise.all(
          result.map(async (comment: Comment) => {
            if (comment.deletedAt) comment.text = '[comment removed]';
            if (this.currentUser[securityId] === comment.userId) return comment;
            const accountSetting = await this.accountSettingRepository.findOne({
              where: {
                userId: comment.userId,
              },
            });
            if (accountSetting?.accountPrivacy === AccountSettingType.PRIVATE) {
              const friend = await this.friendService.friendRepository.findOne({
                where: {
                  requestorId: this.currentUser[securityId],
                  requesteeId: comment.userId,
                  status: FriendStatusType.APPROVED,
                },
              });

              if (!friend)
                comment.text = '[This comment is from a private account]';
            }

            return comment;
          }),
        );

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

    const meta = pageMetadata([...pageDetail, count]);

    const paginationFilter = Object.assign(filter, {
      offset: ((meta.currentPage ?? 1) - 1) * meta.itemsPerPage,
      limit: meta.itemsPerPage,
    });

    if (controllerName === ControllerType.REPORTUSER)
      invocationCtx.args[1] = paginationFilter;
    else invocationCtx.args[0] = paginationFilter;

    return meta;
  }

  async getPostByQuery(q: string): Promise<Where<Post>> {
    const approvedFriendIds = await this.friendService.getFriendIds(
      this.currentUser[securityId],
      FriendStatusType.APPROVED,
    );
    const blockedFriendIds = (
      await this.friendService.getFriendIds(
        this.currentUser[securityId],
        FriendStatusType.BLOCKED,
      )
    ).filter(userId => !approvedFriendIds.includes(userId));
    const filterPost = await this.initializeFilter(
      approvedFriendIds,
      blockedFriendIds,
      q,
    );

    if (q[0] === '#') {
      const hashtag = q.replace('#', '').trim();

      filterPost.push(
        {
          and: [
            {tags: {inq: [hashtag]}},
            {visibility: VisibilityType.PUBLIC},
            {createdBy: {nin: blockedFriendIds}},
          ],
        },
        {
          and: [
            {tags: {inq: [hashtag]}},
            {visibility: VisibilityType.FRIEND},
            {createdBy: {inq: approvedFriendIds}},
          ],
        },
        {
          and: [
            {tags: {inq: [hashtag]}},
            {createdBy: this.currentUser[securityId]},
          ],
        },
      );
    } else if (q[0] === '@') {
      const mention = q.replace('@', '').trim();

      filterPost.push(
        {
          and: [
            {'mentions.name': {inq: [mention]}},
            {visibility: VisibilityType.PUBLIC},
            {createdBy: {nin: blockedFriendIds}},
          ],
        },
        {
          and: [
            {'mentions.name': {inq: [mention]}},
            {visibility: VisibilityType.FRIEND},
            {createdBy: {inq: approvedFriendIds}},
          ],
        },
        {
          and: [
            {'mentions.name': {inq: [mention]}},
            {createdBy: this.currentUser[securityId]},
          ],
        },
        {
          and: [
            {'mentions.username': {inq: [mention]}},
            {visibility: VisibilityType.PUBLIC},
            {createdBy: {nin: blockedFriendIds}},
          ],
        },
        {
          and: [
            {'mentions.username': {inq: [mention]}},
            {visibility: VisibilityType.FRIEND},
            {createdBy: {inq: approvedFriendIds}},
          ],
        },
        {
          and: [
            {'mentions.username': {inq: [mention]}},
            {createdBy: this.currentUser[securityId]},
          ],
        },
      );
    } else {
      const regexTopic = new RegExp(`\\b${q}\\b`, 'i');

      filterPost.push(
        {
          and: [
            {rawText: {regexp: regexTopic}},
            {visibility: VisibilityType.PUBLIC},
            {createdBy: {nin: blockedFriendIds}},
          ],
        },
        {
          and: [
            {rawText: {regexp: regexTopic}},
            {visibility: VisibilityType.FRIEND},
            {createdBy: {inq: approvedFriendIds}},
          ],
        },
        {
          and: [
            {rawText: {regexp: regexTopic}},
            {createdBy: this.currentUser[securityId]},
          ],
        },
      );
    }

    return {or: filterPost} as Where<Post>;
  }

  async getTopicByQuery(topic: string): Promise<Where<Post>> {
    const hashtag = topic.toLowerCase();
    const approvedFriendIds = await this.friendService.getFriendIds(
      this.currentUser[securityId],
      FriendStatusType.APPROVED,
    );
    const blockedFriendIds = (
      await this.friendService.getFriendIds(
        this.currentUser[securityId],
        FriendStatusType.BLOCKED,
      )
    ).filter(userId => !approvedFriendIds.includes(userId));

    return {
      or: [
        {
          and: [
            {createdBy: {nin: blockedFriendIds}},
            {tags: {inq: [hashtag]}},
            {visibility: VisibilityType.PUBLIC},
          ],
        },
        {
          and: [
            {createdBy: {inq: approvedFriendIds}},
            {tags: {inq: [hashtag]}},
            {visibility: VisibilityType.FRIEND},
          ],
        },
        {
          and: [
            {createdBy: this.currentUser[securityId]},
            {tags: {inq: [hashtag]}},
          ],
        },
      ],
    } as Where<Post>;
  }

  async getExperienceByQuery(q: string): Promise<Where<Experience>> {
    const blockedFriendIds = await this.friendService.getFriendIds(
      this.currentUser[securityId],
      FriendStatusType.BLOCKED,
    );

    const pattern = new RegExp(q, 'i');
    return {
      and: [{name: {regexp: pattern}}, {createdBy: {nin: blockedFriendIds}}],
    };
  }

  async getTimeline(
    timelineType: TimelineType,
    experienceId?: string,
  ): Promise<Where<Post> | undefined> {
    const userId = this.currentUser[securityId];

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

  async initializeFilter(
    approvedFriendIds: string[],
    blockedFriendIds: string[],
    q: string,
  ): Promise<AnyObject[]> {
    const pattern = new RegExp(`\\b${q}\\b`, 'i');
    const filterUser: AnyObject[] = [
      {
        and: [{name: {regexp: pattern}}, {id: {nin: blockedFriendIds}}],
      },
      {
        and: [{name: {regexp: pattern}}, {id: {inq: approvedFriendIds}}],
      },
    ];
    if (!q.match(/^#|^@/)) {
      filterUser.push(
        {
          and: [{username: {regexp: pattern}}, {id: {nin: blockedFriendIds}}],
        },
        {
          and: [{username: {regexp: pattern}}, {id: {inq: approvedFriendIds}}],
        },
      );
    }
    const users = await this.userRepository.find({where: {or: filterUser}});
    const friendUserIds = users
      .filter(user => approvedFriendIds.includes(user.id))
      .map(e => e.id);
    const publicUserIds = users
      .filter(user => !approvedFriendIds.includes(user.id))
      .map(e => e.id);

    return [
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
    ];
  }
}
