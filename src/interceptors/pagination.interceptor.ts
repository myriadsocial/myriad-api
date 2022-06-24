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
  ReferenceType,
  TimelineType,
  VisibilityType,
} from '../enums';
import {
  Experience,
  Friend,
  Post,
  PostWithRelations,
  User,
  UserExperienceWithRelations,
} from '../models';
import {
  CurrencyService,
  ExperienceService,
  FriendService,
  MetricService,
  PostService,
  TagService,
} from '../services';
import {pageMetadata} from '../utils/page-metadata.utils';
import {
  AccountSettingRepository,
  CurrencyRepository,
  UserRepository,
  WalletRepository,
  UserExperienceRepository,
  ReportRepository,
} from '../repositories';
import {MetaPagination} from '../interfaces';
import {UserProfile, securityId} from '@loopback/security';
import {omit, pull} from 'lodash';

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
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
    @repository(UserExperienceRepository)
    protected userExperienceRepository: UserExperienceRepository,
    @repository(ReportRepository)
    protected reportRepository: ReportRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
    @service(MetricService)
    protected metricService: MetricService,
    @service(CurrencyService)
    protected currencyService: CurrencyService,
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

  orderSetting(query: AnyObject, hasExperience = null): string[] {
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
    if (hasExperience) {
      return [`experienceIndex.${hasExperience} DESC`, sortBy + ' ' + order];
    }

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
    const filter =
      invocationCtx.args[0] && typeof invocationCtx.args[0] === 'object'
        ? invocationCtx.args[0]
        : {where: {}};

    filter.where = filter.where ?? {};

    switch (controllerName) {
      case ControllerType.USER: {
        const {requestorId, requesteeId, friendsName, userId, name} =
          request.query;
        const hasWhere =
          Object.keys(filter.where as Where<AnyObject>).length > 0;
        if (
          (friendsName && (requestorId || requesteeId || hasWhere)) ||
          ((requestorId || requesteeId) && (friendsName || hasWhere)) ||
          (hasWhere && (friendsName || requestorId || requesteeId))
        ) {
          throw new HttpErrors.UnprocessableEntity(
            'Cannot used where filter together with friendsName and (requesteeId, requestorId)',
          );
        }

        if (requestorId || requesteeId) {
          if (!requestorId)
            throw new HttpErrors.UnprocessableEntity(
              'Please input requesteeId',
            );
          if (!requesteeId)
            throw new HttpErrors.UnprocessableEntity(
              'Please input requestorId',
            );
          const userIds = this.friendService.getMutualUserIds(
            requestorId.toString(),
            requesteeId.toString(),
          );

          filter.order = this.orderSetting(request.query);
          filter.where = {
            id: {inq: userIds},
            deletedAt: {
              $eq: null,
            },
          };
        } else if (friendsName) {
          if (!userId)
            throw new HttpErrors.UnprocessableEntity('UserId cannot be empty');
          const searchQuery = await this.getSearchFriendByQuery(
            userId.toString(),
            friendsName.toString(),
            invocationCtx,
          );
          if (!searchQuery) return;
          filter.where = searchQuery;
          filter.fields = ['id', 'name', 'username', 'profilePictureURL'];
        } else {
          const nameStr = name?.toString();
          const blockedFriendIds = await this.friendService.getFriendIds(
            this.currentUser[securityId],
            FriendStatusType.BLOCKED,
            true,
          );

          if (nameStr) {
            Object.assign(filter.where, {
              or: [
                {
                  username: {
                    like: `.*${nameStr}`,
                    options: 'i',
                  },
                },
                {
                  name: {
                    like: `.*${nameStr}`,
                    options: 'i',
                  },
                },
              ],
            });
          }

          Object.assign(filter, {
            order: this.orderSetting(request.query),
            where: {
              ...filter.where,
              id: {
                nin: blockedFriendIds,
              },
              deletedAt: {
                $eq: null,
              },
            },
          });
        }

        break;
      }

      case ControllerType.REPORTUSER: {
        filter.include = ['reporter'];
        filter.order = this.orderSetting(request.query);

        Object.assign(filter.where, {
          reportId: invocationCtx.args[0],
        });

        break;
      }

      // Set where filter when using timeline
      // Both Where filter and timeline cannot be used together
      case ControllerType.POST: {
        let hasExperience = null;
        if (methodName === MethodType.TIMELINE) {
          const {experienceId, timelineType, q, topic} = request.query;
          const hasWhere =
            Object.keys(filter.where as Where<AnyObject>).length > 0;

          if (
            (q && (topic || timelineType || hasWhere)) ||
            (topic && (q || timelineType || hasWhere)) ||
            (timelineType && (q || topic || hasWhere)) ||
            (hasWhere && (q || topic || timelineType))
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
          if (!timelineType && typeof timelineType === 'string') return;
          if (timelineType) {
            const whereTimeline = await this.getTimeline(
              timelineType as TimelineType,
              experienceId?.toString(),
            );

            if (!whereTimeline) return;

            hasExperience = (whereTimeline as AnyObject).experienceId;
            filter.where = omit(whereTimeline, ['experienceId']);
          }

          filter.where.banned = false;
          filter.where.deletedAt = {$eq: null};
          filter.include = filter.include
            ? [...filter.include, 'user']
            : ['user'];
        }

        if (methodName === MethodType.GETIMPORTERS) {
          const [originPostId, platform, importerFilter = {where: {}}] =
            invocationCtx.args;

          filter.include = ['user'];
          filter.where = {
            ...importerFilter.where,
            originPostId: originPostId,
            platform: platform,
          };
        }

        filter.order = this.orderSetting(request.query, hasExperience);

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
              new RegExp('[^A-Za-z0-9 ]', 'gi'),
              '',
            );
          }

          filter.where = await this.getExperienceByQuery(experienceQuery);
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

      case ControllerType.EXPERIENCEPOST: {
        filter.order = this.orderSetting(request.query);
        filter.include = invocationCtx.args[1]?.include ?? [];
        filter.where = {
          deletedAt: {$eq: null},
          banned: false,
        };
        break;
      }

      case ControllerType.USERWALLET: {
        Object.assign(filter, invocationCtx.args[1] ?? {});
        break;
      }

      case ControllerType.TRANSACTION: {
        const {referenceId, currencyId, referenceType, status} = request.query;
        const profile = referenceType === ReferenceType.USER && referenceId;

        switch (referenceType) {
          case ReferenceType.POST:
          case ReferenceType.COMMENT: {
            if (!referenceId) {
              throw new HttpErrors.UnprocessableEntity(
                'Please input reference id',
              );
            }
            filter.where = {referenceId, type: referenceType};
            break;
          }

          default: {
            let userId;
            if (profile) {
              Object.assign(filter.where, {
                type: {
                  nin: [ReferenceType.POST],
                },
              });
              userId = referenceId ? referenceId.toString() : undefined;
            }

            const wallets = await this.walletRepository.find({
              where: {
                userId: userId ?? this.currentUser[securityId],
              },
            });
            const walletIds = wallets.map(wallet => wallet.id);
            if (status === 'received' || profile) {
              Object.assign(filter.where, {
                to: {
                  inq: walletIds,
                },
              });
            } else if (status === 'sent') {
              Object.assign(filter.where, {
                from: {
                  inq: walletIds,
                },
              });
            } else {
              Object.assign(filter.where, {
                or: [
                  {
                    from: {
                      inq: walletIds,
                    },
                  },
                  {
                    to: {
                      inq: walletIds,
                    },
                  },
                ],
              });
            }
          }
        }

        if (currencyId) {
          Object.assign(filter.where, {currencyId});
        }

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

        await this.currencyService.updateUserCurrency(
          this.currentUser[securityId],
          networkId,
        );

        filter.order = ['priority ASC'];

        Object.assign(filter.where, {
          userId: wallet?.userId ?? '',
          networkId: networkId,
        });

        const {q} = request.query;

        // search experience
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
          const userExperiences = this.experienceService.combinePeopleAndUser(
            result as UserExperienceWithRelations[],
          );

          const privateUserExp =
            await this.experienceService.privateUserExperience(
              this.currentUser[securityId],
              userExperiences,
            );

          result = privateUserExp.filter((e: AnyObject) => {
            if (e.private) {
              if (e.friend) return true;
              return false;
            } else {
              if (!e.blocked) return true;
              return false;
            }
          });
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
            const {count} = await this.userExperienceRepository.count({
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
                  return Object.assign(e?.user ?? {}, {
                    name: 'Unknown Myrian',
                    username: 'Unknown Myrian',
                  });
                }

                if (e.visibility === VisibilityType.FRIEND) {
                  if (this.currentUser[securityId] === e.createdBy)
                    return e.user;
                  const friend =
                    await this.friendService.friendRepository.findOne({
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

      case ControllerType.EXPERIENCEPOST: {
        result = await Promise.all(
          result.map(async (post: Post) =>
            this.postService.getPostImporterInfo(
              post,
              this.currentUser[securityId],
            ),
          ),
        );
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
          result.map(async (comment: AnyObject) => {
            if (comment.deletedAt) {
              const report = await this.reportRepository.findOne({
                where: {
                  referenceId: result.id,
                  referenceType: ReferenceType.COMMENT,
                },
              });

              comment.text = '[comment removed]';
              comment.reportType = report?.type;
            }

            if (this.currentUser[securityId] === comment.userId) return comment;
            const accountSetting = await this.accountSettingRepository.findOne({
              where: {
                userId: comment.userId,
              },
            });
            if (accountSetting?.accountPrivacy === AccountSettingType.PRIVATE) {
              const friend = await this.friendService.friendRepository.findOne({
                where: <AnyObject>{
                  requestorId: this.currentUser[securityId],
                  requesteeId: comment.userId,
                  status: FriendStatusType.APPROVED,
                  deletedAt: {
                    $eq: null,
                  },
                },
              });

              if (!friend)
                comment.text = '[This comment is from a private account]';
              comment.privacy = 'private';
            }

            return {...comment};
          }),
        );

        break;
      }

      // Changed user name and username to [user banned] when user is deleted
      case ControllerType.USER: {
        const {friendsName, mutual} = request.query;

        if (friendsName) {
          const [_, userIds, requestor] = invocationCtx.args;
          result = Promise.all(
            result.map(async (user: User) => {
              const friend: AnyObject = {
                id: userIds[user.id],
                requestorId: requestor.id,
                requesteeId: user.id,
                status: FriendStatusType.APPROVED,
                requestee: {
                  id: user.id,
                  name: user.name,
                  username: user.username,
                  profilePictureURL: user.profilePictureURL,
                },
                requestor: {
                  id: requestor.id,
                  name: requestor.name,
                  username: requestor.username,
                  profilePictureURL: requestor.profilePictureURL,
                },
              };

              if (mutual === 'true') {
                const {count} = await this.friendService.countMutual(
                  requestor.id,
                  user.id,
                );

                friend.totalMutual = count;
              }
              return friend;
            }),
          );
        } else {
          result = result.map((user: User) => {
            if (user.deletedAt) {
              user.name = '[user banned]';
              user.username = '[user banned]';
            }
            return omit(user, ['friendIndex', 'nonce', 'permissions']);
          });
        }

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
      controllerName === ControllerType.USERWALLET ||
      controllerName === ControllerType.EXPERIENCEPOST
    )
      invocationCtx.args[1] = paginationFilter;
    else if (methodName === MethodType.GETIMPORTERS)
      invocationCtx.args[2] = paginationFilter;
    else invocationCtx.args[0] = paginationFilter;

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

  async getExperienceByQuery(q: string): Promise<Where<Experience>> {
    const userId = this.currentUser?.[securityId];
    const [blockedFriendIds, approvedFriendIds] = await Promise.all([
      this.friendService.getFriendIds(userId, FriendStatusType.BLOCKED),
      this.friendService.getFriendIds(userId, FriendStatusType.APPROVED),
    ]);

    const pattern = new RegExp(q, 'i');
    const userIds = pull(blockedFriendIds, ...approvedFriendIds);

    return {
      and: [{name: {regexp: pattern}}, {createdBy: {nin: userIds}}],
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
    }
  }

  async getSearchFriendByQuery(
    userId: string,
    q: string,
    invocationCtx: InvocationContext,
  ): Promise<Where<User> | void> {
    if (!q || (!q && typeof q === 'string')) return;
    const [requestor, friends] = await Promise.all([
      this.userRepository.findById(userId),
      this.friendService.friendRepository.find({
        where: <AnyObject>{
          requestorId: userId,
          status: FriendStatusType.APPROVED,
          deletedAt: {
            $eq: null,
          },
        },
      }),
    ]);

    if (friends.length === 0) return;
    if (q) {
      const userIds: AnyObject = {};
      const friendIds = friends.map(friend => {
        userIds[friend.requesteeId] = friend.id;
        return friend.requesteeId;
      });
      invocationCtx.args[1] = userIds;
      invocationCtx.args[2] = requestor;

      return {
        id: {inq: friendIds},
        name: {
          like: `${encodeURI(q)}.*`,
          options: 'i',
        },
        deletedAt: {
          $eq: null,
        },
      } as Where<User>;
    }

    return;
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
}
