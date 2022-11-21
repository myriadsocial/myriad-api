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
import {AnyObject, Filter, repository, Where} from '@loopback/repository';
import {HttpErrors, Request, RestBindings} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {Query} from 'express-serve-static-core';
import {pull} from 'lodash';
import {
  AccountSettingType,
  ControllerType,
  FriendStatusType,
  MethodType,
  OrderFieldType,
  OrderType,
  PlatformType,
  ReferenceType,
  SectionType,
  TimelineType,
  VisibilityType,
} from '../enums';
import {MetaPagination} from '../interfaces';
import {FriendWithRelations, Post, PostWithRelations, User} from '../models';
import {
  AccountSettingRepository,
  CurrencyRepository,
  ReportRepository,
  UserExperienceRepository,
  UserRepository,
  WalletRepository,
} from '../repositories';
import {
  CurrencyService,
  ExperienceService,
  FriendService,
  MetricService,
  TagService,
  TransactionService,
  UserService,
} from '../services';
import {pageMetadata} from '../utils/formatter';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: PaginationInterceptor.BINDING_KEY}})
export class PaginationInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${PaginationInterceptor.name}`;

  constructor(
    @repository(AccountSettingRepository)
    private accountSettingRepository: AccountSettingRepository,
    @repository(UserRepository)
    private userRepository: UserRepository,
    @repository(CurrencyRepository)
    private currencyRepository: CurrencyRepository,
    @repository(UserExperienceRepository)
    private userExperienceRepository: UserExperienceRepository,
    @repository(ReportRepository)
    private reportRepository: ReportRepository,
    @repository(WalletRepository)
    private walletRepository: WalletRepository,
    @service(MetricService)
    private metricService: MetricService,
    @service(CurrencyService)
    private currencyService: CurrencyService,
    @service(ExperienceService)
    private experienceService: ExperienceService,
    @service(TagService)
    private tagService: TagService,
    @service(TransactionService)
    private transactionService: TransactionService,
    @service(FriendService)
    private friendService: FriendService,
    @service(UserService)
    private userService: UserService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private currentUser: UserProfile,
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

      case OrderFieldType.TIP:
        sortBy = 'metric.tips';
        break;

      case OrderFieldType.LATEST:
        sortBy = 'createdAt';
        break;

      case OrderFieldType.NAME:
        sortBy = 'name';
        break;

      case OrderFieldType.USERNAME:
        sortBy = 'username';
        break;

      default:
        sortBy = 'createdAt';
    }

    if (!order) order = OrderType.DESC;
    if (query.name) {
      return [
        `friendIndex.${this.currentUser[securityId]} DESC`,
        sortBy + ' ' + order,
      ];
    }

    return [sortBy + ' ' + order];
  }

  async beforePagination(
    invocationCtx: InvocationContext,
    request: Request,
  ): Promise<Filter<AnyObject> | void> {
    const methodName = invocationCtx.methodName as MethodType;
    const controllerName = invocationCtx.targetClass.name as ControllerType;
    const filter = this.defaultFilter(invocationCtx);

    switch (controllerName) {
      case ControllerType.USER: {
        if (methodName === MethodType.LOG) {
          Object.assign(filter.where, {
            userId: this.currentUser[securityId],
          });
        } else {
          await this.handleUserFilter(filter, request.query, invocationCtx);
        }

        break;
      }

      case ControllerType.REPORTUSER:
        Object.assign(filter, {
          where: {
            ...filter.where,
            reportId: invocationCtx.args[0],
          },
          include: ['reporter'],
          order: this.orderSetting(request.query),
        });
        break;

      case ControllerType.POST: {
        const [originPostId, platform, importerFilter = {where: {}}] =
          invocationCtx.args;

        filter.order = this.orderSetting(request.query);
        filter.include = ['user'];
        filter.where = {
          ...importerFilter.where,
          originPostId: originPostId,
          platform: platform,
        };
        break;
      }
      // Set where filter when using timeline
      // Both Where filter and timeline cannot be used together
      case ControllerType.USERPOST: {
        const {experienceId, timelineType, q, topic} = request.query;

        if (
          (q && (topic || timelineType)) ||
          (topic && (q || timelineType)) ||
          (timelineType && (q || topic))
        ) {
          throw new HttpErrors.UnprocessableEntity(
            'Cannot used where filter together with q, topic, and timelineType',
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
        }

        // search topic
        if (!topic && typeof topic === 'string') return;
        if (topic) {
          filter.where = await this.getTopicByQuery(topic.toString());
        }

        // get timeline
        if (timelineType || (!q && !topic && !timelineType)) {
          filter.where = await this.getTimeline(
            (timelineType ?? TimelineType.PROFILE) as TimelineType,
            experienceId?.toString(),
            request.query,
          );
        }

        const experience = {
          relation: 'experiences',
          scope: {
            limit: 1,
            order: ['name ASC'],
            where: {
              deletedAt: {
                $exists: false,
              },
            },
          },
        };

        filter.order = this.orderSetting(request.query);
        filter.where.banned = false;
        filter.where.deletedAt = {$eq: null};
        filter.include = filter.include
          ? [...filter.include, 'user', experience]
          : ['user', experience];

        break;
      }

      case ControllerType.EXPERIENCE: {
        const {q} = request.query;

        // search experience
        if (!q && typeof q === 'string') return;
        if (q) {
          let experienceQuery = q.toString();

          const matchWord = experienceQuery.match('^[A-Za-z0-9]');
          if (experienceQuery.length === 1 && !matchWord) return;
          if (experienceQuery.length > 1) {
            experienceQuery = experienceQuery.replace(
              new RegExp('[^A-Za-z0-9 ]', 'gi'),
              '',
            );
          }

          await this.experienceService.search(filter.where, experienceQuery);
        } else {
          const userId = this.currentUser?.[securityId];
          const [blockedFriendIds, approvedFriendIds] = await Promise.all([
            this.friendService.getFriendIds(userId, FriendStatusType.BLOCKED),
            this.friendService.getFriendIds(userId, FriendStatusType.APPROVED),
          ]);
          const userIds = pull(blockedFriendIds, ...approvedFriendIds);

          if (!filter?.where?.createdBy) {
            filter.where.createdBy = {nin: userIds};
          }
        }

        filter.where.deletedAt = {$eq: null};

        break;
      }

      case ControllerType.POSTEXPERIENCE:
      case ControllerType.EXPERIENCEPOST: {
        const userId = this.currentUser?.[securityId];

        filter.order = this.orderSetting(request.query);
        filter.include = invocationCtx.args[1]?.include ?? [];
        filter.where = {deletedAt: {$eq: null}};

        if (controllerName === ControllerType.EXPERIENCEPOST) {
          const experienceId = invocationCtx.args[0];
          const where = await this.getExperincePostQuery(userId, experienceId);

          Object.assign(filter.where, {...where, banned: false});
        }
        break;
      }

      case ControllerType.WALLET: {
        Object.assign(filter, invocationCtx.args[1] ?? {});
        break;
      }

      case ControllerType.TRANSACTION: {
        this.transactionService.detail(filter.where, request.query);
        break;
      }

      case ControllerType.USERCURRENCY: {
        const wallet = await this.walletRepository.findOne({
          where: {
            userId: this.currentUser?.[securityId] ?? '',
            primary: true,
          },
        });

        const networkId = wallet?.networkId ?? '';

        await this.currencyService.update(
          this.currentUser[securityId],
          networkId,
        );

        filter.order = ['priority ASC'];

        Object.assign(filter.where, {
          userId: wallet?.userId ?? '',
          networkId: networkId,
        });

        const {q} = request.query;

        // search currency
        if (q) {
          const pattern = new RegExp(q.toString(), 'i');
          const currencies = await this.currencyRepository.find({
            where: {
              or: [{name: {regexp: pattern}}, {symbol: {regexp: pattern}}],
            },
          });
          const currencyIds = currencies.map(currency => currency.id);

          Object.assign(filter.where, {
            currencyId: {inq: currencyIds},
          });
        }

        break;
      }

      case ControllerType.COMMENT: {
        const {userId, referenceId, section} = request.query;

        if (userId) {
          filter.where = {userId: userId.toString()};
        } else {
          filter.where = {
            referenceId: !referenceId ? '' : referenceId,
            section: !section ? SectionType.DISCUSSION : section,
          };
        }

        break;
      }

      case ControllerType.FRIEND: {
        const {status, userId} = request.query;

        Object.assign(filter.where, {status, deletedAt: {$eq: null}});

        switch (status) {
          case FriendStatusType.PENDING:
            Object.assign(filter.where, {
              requesteeId: this.currentUser?.[securityId],
            });
            break;

          case FriendStatusType.BLOCKED: {
            if (!userId) return;

            Object.assign(filter.where, {
              or: [{requestorId: userId}, {requsteeId: userId}],
            });

            break;
          }

          case FriendStatusType.APPROVED: {
            if (!userId) return;
            if (userId !== this.currentUser[securityId]) {
              const asFriend = await this.friendService.asFriend(
                userId.toString(),
                this.currentUser[securityId],
              );

              if (!asFriend) {
                const isPrivate = await this.accountSettingRepository.findOne({
                  where: {
                    userId: userId.toString(),
                    accountPrivacy: AccountSettingType.PRIVATE,
                  },
                });

                if (isPrivate) return;
              }
            }

            Object.assign(filter.where, {requestorId: userId.toString()});

            break;
          }

          default:
            return;
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
      case ControllerType.POST: {
        // include importers in post collection
        if (methodName === MethodType.TIMELINE) {
          if (request.query.experienceId) {
            Promise.allSettled([
              this.userExperienceRepository
                .count({
                  userId: this.currentUser[securityId],
                  experienceId: request.query.experienceId.toString(),
                })
                .then(({count}) => {
                  if (count === 1 && request.query.experienceId) {
                    return this.userRepository.updateById(
                      this.currentUser[securityId],
                      {
                        onTimeline: request.query.experienceId.toString(),
                      },
                    );
                  }
                }),
            ]) as Promise<AnyObject>;
          }
        }

        // rename importers detail
        if (methodName === MethodType.GETIMPORTERS) {
          result = (
            await Promise.all(
              result.map(async (e: PostWithRelations) => {
                if (e.visibility === VisibilityType.PRIVATE) {
                  return Object.assign(e?.user ?? {}, {
                    name: 'Unknown Myrian',
                    username: 'Unknown Myrian',
                  });
                }

                if (e.visibility === VisibilityType.FRIEND) {
                  if (this.currentUser[securityId] === e.createdBy)
                    return e.user;
                  const friend = await this.friendService.findOne({
                    where: <AnyObject>{
                      requestorId: this.currentUser[securityId],
                      requesteeId: e.createdBy,
                      status: FriendStatusType.APPROVED,
                      deletedAt: {
                        $eq: null,
                      },
                    },
                  });

                  if (friend) return e.user;

                  return Object.assign(e?.user ?? {}, {
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
            const currentUser = this.currentUser?.[securityId] ?? '';

            result = await Promise.all(
              result.map(async (friend: FriendWithRelations) => {
                const {requestorId, requesteeId, requestee} = friend;
                const {count: totalMutual} =
                  await this.friendService.countMutual(
                    requestorId,
                    requesteeId,
                  );

                if (!requestee || requestorId === currentUser) {
                  return Object.assign(friend, {totalMutual});
                }

                const friendInfo = await this.friendService.getFriendInfo(
                  currentUser,
                  requesteeId,
                );

                if (!friendInfo) return Object.assign(friend, {totalMutual});

                return {
                  ...friend,
                  requestee: {
                    ...requestee,
                    friendInfo,
                  },
                };
              }),
            );
          }
        }

        break;
      }

      // Changed comment text to [comment removed] when comment is deleted
      case ControllerType.COMMENT: {
        result = await Promise.all(
          result.map(async (comment: AnyObject) => {
            if (comment.deletedAt) {
              const report = await this.reportRepository.findOne({
                where: {
                  referenceId: comment.id,
                  referenceType: ReferenceType.COMMENT,
                },
              });

              comment.text = '[comment removed]';
              comment.reportType = report?.type;

              return {...comment};
            }

            if (this.currentUser[securityId] === comment?.post?.createdBy) {
              if (this.currentUser[securityId] === comment?.userId) {
                return {...comment};
              }

              const accountSetting =
                await this.accountSettingRepository.findOne({
                  where: {
                    userId: comment.userId,
                  },
                });

              if (
                accountSetting?.accountPrivacy === AccountSettingType.PRIVATE
              ) {
                const asFriend = await this.friendService.asFriend(
                  this.currentUser[securityId],
                  comment.userId,
                );

                if (!asFriend) {
                  comment.text = '[This comment is from a private account]';
                  comment.privacy = 'private';
                }
              }

              return {...comment};
            }

            const visibility = comment?.post?.visibility;

            if (!visibility || visibility === VisibilityType.PRIVATE) {
              if (this.currentUser[securityId] !== comment?.userId) {
                comment.text = '[This comment is from a private post]';
                comment.privacy = 'private';
              } else {
                if (comment?.post?.text) {
                  comment.post = {
                    ...comment.post,
                    text: '[This is a private post]',
                    rawText: '[This is a private post]',
                  };
                }
              }

              return {...comment};
            }

            if (this.currentUser[securityId] === comment?.userId) {
              return {...comment};
            }

            if (visibility === VisibilityType.FRIEND) {
              const asFriend = await this.friendService.asFriend(
                this.currentUser[securityId],
                comment.post.createdBy,
              );

              if (!asFriend) {
                comment.text = '[This comment is from an private post]';
                comment.privacy = 'private';
              }

              return {...comment};
            }

            const accountSetting = await this.accountSettingRepository.findOne({
              where: {
                userId: comment.userId,
              },
            });
            if (accountSetting?.accountPrivacy === AccountSettingType.PRIVATE) {
              const asFriend = await this.friendService.asFriend(
                this.currentUser[securityId],
                comment.userId,
              );

              if (!asFriend) {
                comment.text = '[This comment is from a private account]';
                comment.privacy = 'private';
              }
            }

            return {...comment};
          }),
        );

        break;
      }

      case ControllerType.USER: {
        const {friendsName, mutual, name} = request.query;
        const properties = {
          friendsName: friendsName?.toString(),
          mutual: mutual?.toString(),
          name: name?.toString(),
          additional: {
            userIds: invocationCtx.args?.[1],
            requestor: invocationCtx.args?.[2],
          },
        };

        return this.userService.afterFind(result as User[], properties);
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
    const where = filter.where as Where<AnyObject>;

    const {count} = await this.metricService.countData(
      controllerName,
      where,
      invocationCtx.args[0],
    );

    const meta = pageMetadata([...pageDetail, count]);
    const paginationFilter = Object.assign(filter, {
      offset: ((meta.currentPage ?? 1) - 1) * meta.itemsPerPage,
      limit: meta.itemsPerPage,
    });

    if (
      controllerName === ControllerType.REPORTUSER ||
      controllerName === ControllerType.WALLET ||
      controllerName === ControllerType.EXPERIENCEPOST ||
      controllerName === ControllerType.POSTEXPERIENCE
    )
      invocationCtx.args[1] = paginationFilter;
    else if (methodName === MethodType.GETIMPORTERS)
      invocationCtx.args[2] = paginationFilter;
    else invocationCtx.args[0] = paginationFilter;

    if (controllerName === ControllerType.USEREXPERIENCE) {
      const {count: totalOwnedExp} = await this.userExperienceRepository.count({
        userId: this.currentUser[securityId],
        subscribed: false,
      });

      meta.additionalData = {
        totalOwnedExperience: totalOwnedExp,
      };
    }

    return meta;
  }

  async getPostByQuery(q: string): Promise<Where<Post>> {
    const currentUser = this.currentUser[securityId];
    const [approvedFriendIds, blockedFriends] = await Promise.all([
      this.friendService.getFriendIds(currentUser, FriendStatusType.APPROVED),
      this.friendService.getFriendIds(currentUser, FriendStatusType.BLOCKED),
    ]);

    const blockedFriendIds = pull(blockedFriends, ...approvedFriendIds);
    const filterPost = await this.initializeFilter(
      approvedFriendIds,
      blockedFriendIds,
      q,
    );

    if (q.startsWith('#')) {
      const hashtag = q.replace('#', '').trim().toLowerCase();

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
    } else if (q.startsWith('@')) {
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
    const currentUser = this.currentUser[securityId];
    const [approvedFriendIds, blockedFriends] = await Promise.all([
      this.friendService.getFriendIds(currentUser, FriendStatusType.APPROVED),
      this.friendService.getFriendIds(currentUser, FriendStatusType.BLOCKED),
    ]);

    const blockedFriendIds = pull(blockedFriends, ...approvedFriendIds);
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

  async getExperincePostQuery(
    userId: string,
    experienceId: string,
  ): Promise<Where<Post>> {
    return Promise.all([
      this.experienceService.getExperiencePostId(experienceId),
      this.friendService.getFriendIds(userId, FriendStatusType.APPROVED),
      this.friendService.getFriendIds(userId, FriendStatusType.BLOCKED),
    ]).then(([postIds, friends, blockedFriendIds]) => {
      const blocked = pull(blockedFriendIds, ...friends);
      return {
        or: [
          {
            and: [
              {id: {inq: postIds}},
              {createdBy: {nin: blocked}},
              {visibility: VisibilityType.PUBLIC},
            ],
          },
          {
            and: [
              {id: {inq: postIds}},
              {createdBy: {inq: friends}},
              {visibility: VisibilityType.FRIEND},
            ],
          },
          {
            and: [{id: {inq: postIds}}, {createdBy: {inq: [userId]}}],
          },
        ],
      } as Where<Post>;
    });
  }

  async getTimeline(
    timelineType: TimelineType,
    experienceId?: string,
    query?: Query,
  ): Promise<Where<Post>> {
    const userId = this.currentUser[securityId];

    switch (timelineType) {
      case TimelineType.EXPERIENCE:
        return this.experienceService.timeline(userId, experienceId);

      case TimelineType.TRENDING:
        return this.tagService.timeline(userId);

      case TimelineType.FRIEND:
        return this.friendService.timeline(userId);

      case TimelineType.ALL: {
        return Promise.all([
          this.friendService.getFriendIds(userId, FriendStatusType.APPROVED),
          this.friendService.getFriendIds(userId, FriendStatusType.BLOCKED),
        ]).then(([friends, blockedFriendIds]) => {
          const blocked = pull(blockedFriendIds, ...friends);

          return {
            or: [
              {
                and: [
                  {createdBy: {nin: blocked}},
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
        });
      }

      default: {
        const where: AnyObject = {};

        if (query) {
          const {platform, owner} = query;

          if (platform === 'myriad') {
            where.platform = PlatformType.MYRIAD;
          }

          if (platform === 'imported') {
            where.platform = {
              inq: [
                PlatformType.TWITTER,
                PlatformType.REDDIT,
                PlatformType.FACEBOOK,
              ],
            };
          }

          if (owner) {
            where.createdBy = owner;

            if (owner !== userId) {
              const asFriend = await this.friendService.asFriend(
                owner.toString(),
                userId,
              );

              if (asFriend) {
                where.visibility = {
                  inq: [VisibilityType.FRIEND, VisibilityType.PUBLIC],
                };
              } else {
                const isPrivate = await this.accountSettingRepository.findOne({
                  where: {
                    userId: owner.toString(),
                    accountPrivacy: AccountSettingType.PRIVATE,
                  },
                });

                if (isPrivate) where.id = '';
                else where.visibility = VisibilityType.PUBLIC;
              }
            }
          }
        } else {
          const blockedIds = await this.friendService.getFriendIds(
            userId,
            FriendStatusType.BLOCKED,
          );

          where.visibility = VisibilityType.PUBLIC;
          where.createdBy = {
            inq: blockedIds,
          };
        }

        return where as Where<Post>;
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
    const nonDeletedUser = {or: filterUser, deletedAt: {$eq: null}};
    const users = await this.userRepository.find({where: nonDeletedUser});
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

  private async handleUserFilter(
    filter: Filter<User>,
    query: Query,
    invocationCtx: InvocationContext,
  ) {
    const hasWhere = Object.keys(filter.where as Where<User>).length > 0;
    const {requestorId, requesteeId, friendsName, userId, name, airdrop} =
      query;

    if (
      (airdrop && (requestorId || requesteeId || hasWhere || friendsName)) ||
      (friendsName && (requestorId || requesteeId || hasWhere || airdrop)) ||
      ((requestorId || requesteeId) && (friendsName || hasWhere || airdrop)) ||
      (hasWhere && (friendsName || requestorId || requesteeId || airdrop))
    ) {
      throw new HttpErrors.UnprocessableEntity('WrongFilterFormat');
    }

    if (airdrop === 'onboarding') {
      const {month, year} = query;
      filter.order = this.orderSetting(query);
      await this.userService.onBoardUserRewardList(
        filter?.where ?? {},
        parseInt(month?.toString() ?? new Date().getMonth().toString()),
        parseInt(year?.toString() ?? new Date().getFullYear().toString()),
      );
    } else if (requestorId || requesteeId) {
      filter.order = this.orderSetting(query);

      await this.userService.mutualUserIds(
        filter?.where ?? {},
        requestorId?.toString(),
        requesteeId?.toString(),
      );
    } else if (friendsName) {
      const result = await this.userService.searchFriend(
        filter?.where ?? {},
        friendsName.toString(),
        userId?.toString(),
      );

      if (!result) return;
      filter.fields = ['id', 'name', 'username', 'profilePictureURL'];
      invocationCtx.args[1] = result.userIds;
      invocationCtx.args[2] = result.requestor;
    } else {
      await this.userService.searchName(filter?.where ?? {}, name?.toString());
      filter.order = this.orderSetting(query);
    }
  }

  private defaultFilter(invocationCtx: InvocationContext): AnyObject {
    const filter =
      invocationCtx.args[0] && typeof invocationCtx.args[0] === 'object'
        ? invocationCtx.args[0]
        : {where: {}};

    filter.where = filter.where ?? {};

    return filter;
  }
}
