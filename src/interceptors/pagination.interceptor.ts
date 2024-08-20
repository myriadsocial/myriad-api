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
import {AnyObject, Filter, repository} from '@loopback/repository';
import {RestBindings} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {Query} from 'express-serve-static-core';
import {omit} from 'lodash';
import {
  ControllerType,
  FriendStatusType,
  MethodType,
  ReferenceType,
  VisibilityType,
} from '../enums';
import {MetaPagination} from '../interfaces';
import {
  CommentWithRelations,
  Experience,
  Friend,
  FriendWithRelations,
  PostWithRelations,
  Transaction,
  UnlockableContent,
  User,
  UserWithRelations,
} from '../models';
import {
  ContentPriceRepository,
  ReportRepository,
  TransactionRepository,
} from '../repositories';
import {
  FilterBuilderService,
  FriendService,
  MetricService,
  UserExperienceService,
  UserService,
} from '../services';
import {generateObjectId, pageMetadata} from '../utils/formatter';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: PaginationInterceptor.BINDING_KEY}})
export class PaginationInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${PaginationInterceptor.name}`;

  constructor(
    @repository(ReportRepository)
    private reportRepository: ReportRepository,
    @repository(TransactionRepository)
    private transactionRepository: TransactionRepository,
    @repository(ContentPriceRepository)
    private contentPriceRepository: ContentPriceRepository,
    @service(FilterBuilderService)
    private filterBuilderService: FilterBuilderService,
    @service(FriendService)
    private friendService: FriendService,
    @service(MetricService)
    private metricService: MetricService,
    @service(UserService)
    private userService: UserService,
    @service(UserExperienceService)
    private userExperienceService: UserExperienceService,
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
    const {query} = await invocationCtx.get(RestBindings.Http.REQUEST);
    const {pageNumber, pageLimit} = query;

    const filter = await this.beforePagination(invocationCtx, query);
    const meta = await this.initializeMeta(invocationCtx, filter, [
      Number(pageNumber),
      Number(pageLimit),
    ]);

    const result = await next();
    const updatedResult = await this.afterPagination(
      result,
      invocationCtx,
      query,
    );

    return {
      data: updatedResult,
      meta: meta,
    };
  }

  async beforePagination(
    invocationCtx: InvocationContext,
    query: Query,
  ): Promise<Filter<AnyObject>> {
    const methodName = invocationCtx.methodName as MethodType;
    const controllerName = invocationCtx.targetClass.name as ControllerType;
    const filter = this.initializeFilter(invocationCtx);

    switch (controllerName) {
      case ControllerType.USER: {
        const additional = await this.filterBuilderService.user(
          filter,
          query,
          methodName,
        );

        invocationCtx.args[1] = additional?.userIds;
        invocationCtx.args[2] = additional?.requestor;
        break;
      }

      case ControllerType.USERCOMMENT: {
        await this.filterBuilderService.userComment(filter, query);
        break;
      }

      case ControllerType.USERCURRENCY: {
        await this.filterBuilderService.userCurrency(filter, query);
        break;
      }

      case ControllerType.USERFRIEND: {
        await this.filterBuilderService.userFriend(filter, query);
        break;
      }

      // Set where filter when using timeline
      // Both Where filter and timeline cannot be used together
      case ControllerType.USERPOST: {
        await this.filterBuilderService.userPost(filter, query);
        break;
      }

      case ControllerType.USERTRANSACTION: {
        await this.filterBuilderService.userTransaction(filter, query);
        break;
      }

      case ControllerType.EXPERIENCE: {
        if (methodName === 'find') {
          await this.filterBuilderService.experience(filter, query);
        }

        if (methodName === 'findAdvanced') {
          await this.filterBuilderService.experienceAdvanceSearch(
            filter,
            query,
          );
        }
        break;
      }

      case ControllerType.EXPERIENCEPOST: {
        await this.filterBuilderService.experiencePost(
          filter,
          invocationCtx.args,
          query,
        );
        break;
      }

      case ControllerType.POST: {
        await this.filterBuilderService.post(filter, invocationCtx.args, query);
        break;
      }

      case ControllerType.POSTEXPERIENCE: {
        await this.filterBuilderService.postExperience(
          filter,
          invocationCtx.args,
          query,
        );
        break;
      }

      case ControllerType.REPORTUSER: {
        await this.filterBuilderService.reportUser(
          filter,
          invocationCtx.args,
          query,
        );
        break;
      }

      case ControllerType.USERWALLET: {
        await this.filterBuilderService.userWallet(filter, invocationCtx.args);
        break;
      }
    }

    return filter;
  }

  async afterPagination(
    result: AnyObject,
    invocationCtx: InvocationContext,
    query: Query,
  ): Promise<AnyObject> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;
    const currentUserId = this.currentUser[securityId];

    switch (controllerName) {
      case ControllerType.USER: {
        let {friendsName, mutual, name} = query;

        if (Array.isArray(friendsName)) friendsName = friendsName[0];
        if (Array.isArray(mutual)) mutual = mutual[0];
        if (Array.isArray(name)) name = name[0];

        const [userIds, inquirer] = invocationCtx.args;

        if (friendsName && inquirer && userIds) {
          return Promise.all(
            result.map(async (user: User) => {
              const friend: FriendWithRelations = new Friend();
              friend.id = userIds[user.id];
              friend.requestorId = inquirer.id;
              friend.requesteeId = user.id;
              friend.status = FriendStatusType.APPROVED;
              const requestee = new User() as UserWithRelations;
              requestee.id = user.id;
              requestee.name = user.name;
              requestee.username = user.username;
              requestee.profilePictureURL = user.profilePictureURL;
              const requestor = new User() as UserWithRelations;
              requestor.id = inquirer.id;
              requestor.name = inquirer.name;
              requestor.username = inquirer.username;
              requestor.profilePictureURL = inquirer.profilePictureURL;

              friend.requestor = requestor;
              friend.requestee = requestee;

              if (mutual === 'true') {
                const {count} = await this.friendService.countMutual(
                  requestor.id,
                  user.id,
                );
                friend.totalMutual = count;
              }

              if (currentUserId === friend.requestorId) return friend;
              const info = await this.friendService.getFriendInfo(
                currentUserId,
                user.id,
              );
              if (!info) return friend;
              friend.requestee.friendInfo = info;
              friend.requestee = omit(friend.requestee, [
                'nonce',
                'permission',
                'friendIndex',
              ]) as UserWithRelations;
              return friend;
            }),
          );
        }

        if (name) {
          return Promise.all(
            result.map(async (user: UserWithRelations) => {
              if (currentUserId === user.id) {
                user.friendInfo = {status: 'owner'};
                return omit(user, ['nonce', 'permissions', 'friendIndex']);
              }

              const info = await this.friendService.getFriendInfo(
                currentUserId,
                user.id,
              );
              if (!info) return user;
              user.friendInfo = info;
              return omit(user, ['nonce', 'permissions', 'friendIndex']);
            }),
          );
        }

        return result;
      }

      // include total mutual friend in friend collection
      case ControllerType.USERFRIEND: {
        let {mutual} = query;

        if (Array.isArray(mutual)) mutual = mutual[0];
        return Promise.all(
          result.map(async (friend: FriendWithRelations) => {
            const {requestorId, requesteeId} = friend;

            if (mutual === 'true') {
              const {count: totalMutual} = await this.friendService.countMutual(
                requestorId,
                requesteeId,
              );

              friend.totalMutual = totalMutual;
            }

            if (!friend.requestee) return friend;
            if (requestorId === currentUserId) return friend;

            const info = await this.friendService.getFriendInfo(
              currentUserId,
              requesteeId,
            );

            if (!info) return friend;
            friend.requestee.friendInfo = info;
            friend.requestee = omit(friend.requestee, [
              'nonce',
              'permissions',
              'friendIndex',
            ]) as UserWithRelations;
            return friend;
          }),
        );
      }

      // Changed comment text to [comment removed] when comment is deleted
      case ControllerType.USERCOMMENT: {
        let {exclusiveInfo} = query;

        if (Array.isArray(exclusiveInfo)) exclusiveInfo = exclusiveInfo[0];
        return Promise.all(
          result.map(async (comment: CommentWithRelations) => {
            // mask text when comment is deleted
            if (comment.deletedAt) {
              const report = await this.reportRepository.findOne({
                where: {
                  referenceId: comment.id,
                  referenceType: ReferenceType.COMMENT,
                },
              });

              comment.text = '[comment removed]';
              comment.reportType = report?.type;

              return omit(comment);
            }

            if (exclusiveInfo?.toString() === 'true') {
              const exclusiveContents = comment?.asset?.exclusiveContents ?? [];
              if (exclusiveContents.length > 0) {
                const updatedContents: AnyObject[] = [];
                for (const contentId of exclusiveContents) {
                  const prices = await this.contentPriceRepository.find({
                    include: ['currency'],
                    where: {
                      unlockableContentId: contentId,
                    },
                  });
                  if (prices.length === 0) continue;
                  const updatedPrices = await Promise.all(
                    prices.map(async price => {
                      const collection = (
                        this.transactionRepository.dataSource
                          .connector as AnyObject
                      ).collection(Transaction.modelName);
                      const [total] = await collection
                        .aggregate([
                          {
                            $match: {
                              type: ReferenceType.UNLOCKABLECONTENT,
                              referenceId: contentId,
                              currencyId: price.currency?.id ?? '',
                            },
                          },
                          {
                            $group: {
                              _id: null,
                              amount: {$sum: '$amount'},
                            },
                          },
                        ])
                        .get();

                      return {
                        id: contentId,
                        price: price.amount,
                        decimal: price?.currency?.decimal ?? 0,
                        symbol: price?.currency?.symbol ?? 'UNKNOWN',
                        networId: price?.currency?.networkId ?? 'UNKNOWN',
                        totalAmount: total?.amount ?? 0,
                      };
                    }),
                  );
                  updatedContents.push(...updatedPrices);
                }

                if (updatedContents.length > 0) {
                  const images = comment?.asset?.images ?? [];
                  const videos = comment?.asset?.videos ?? [];
                  const asset: AnyObject = {
                    exclusiveContents: updatedContents,
                  };

                  if (images.length > 0) {
                    Object.assign(asset, {images});
                  }

                  if (videos.length > 0) {
                    Object.assign(asset, {videos});
                  }

                  Object.assign(comment, {asset});
                }
              }
            }

            const post = comment?.post;
            const userId = comment.userId;

            // Check comment creator privacy if post not exist
            if (!post) {
              const isPrivate = await this.userService.isAccountPrivate(userId);
              if (isPrivate) {
                comment.text = '[This comment is from a private account]';
                comment.privacy = 'private';
              }

              return omit(comment);
            }

            // Check comment creator privacy when post creator is current user
            if (currentUserId === post.createdBy) {
              if (currentUserId === userId) return comment;
              const isPrivate = await this.userService.isAccountPrivate(userId);
              if (isPrivate) {
                comment.text = '[This comment is from a private account]';
                comment.privacy = 'private';
              }

              return omit(comment);
            }

            // Post creator is not current user
            // Check comment creator privacy when post visibility is private
            const visibility = post.visibility;
            if (visibility === VisibilityType.PRIVATE) {
              post.text = '[This is a private post]';
              post.rawText = '[This is a private post]';
              comment.post = post;

              if (currentUserId !== userId) {
                comment.text = '[This comment is from a private post]';
                comment.privacy = 'private';
              }

              return omit(comment);
            }

            // Post creator is not current user
            // Check comment creator privacy when post visibility is friend
            if (visibility === VisibilityType.FRIEND) {
              const asFriend = await this.friendService.asFriend(
                currentUserId,
                post.createdBy,
              );

              if (!asFriend) {
                comment.text = '[This comment is from an private post]';
                comment.privacy = 'private';
              }

              return omit(comment);
            }

            if (visibility === VisibilityType.SELECTED) {
              const {selectedUserIds} = post;
              const isSelected = selectedUserIds.includes(currentUserId);
              if (!isSelected) {
                post.text = '[This is a post for selected user only]';
                post.rawText = '[This is a post for selected user only]';
                comment.text = '[This comment is for selected user only]';
                comment.post = post;
                comment.privacy = 'private';
              }
            }

            // Post creator is not current user
            // Check comment creator privacy when post visibility is public
            const isPrivate = await this.userService.isAccountPrivate(userId);
            if (isPrivate) {
              comment.text = '[This comment is from a private account]';
              comment.privacy = 'private';
            }

            return omit(comment);
          }),
        );
      }

      case ControllerType.USERUNLOCKABLECONTENT: {
        return Promise.all(
          result.map(async (content: UnlockableContent) => {
            if (content.createdBy === currentUserId) return content;
            const transaction = await this.transactionRepository.findOne({
              where: {
                referenceId: content.id,
                type: ReferenceType.UNLOCKABLECONTENT,
                from: currentUserId,
                to: content.createdBy,
              },
            });
            if (transaction) return content;
            return omit(content, 'content');
          }),
        );
      }

      case ControllerType.POST: {
        return Promise.all(
          result.map(async (post: PostWithRelations) => {
            const {user, visibility, createdBy} = post;
            if (!user) {
              return new User({
                id: generateObjectId(),
                name: 'Unknown Myrian',
                username: 'unknow_myrian',
              });
            }

            if (currentUserId === createdBy) return user;
            if (visibility === VisibilityType.PRIVATE) {
              user.name = 'Unknown Myrian';
              user.username = 'unknow_myrian';
              return user;
            }

            if (visibility === VisibilityType.FRIEND) {
              const friend = await this.friendService.findOne({
                where: <AnyObject>{
                  requestorId: currentUserId,
                  requesteeId: createdBy,
                  status: FriendStatusType.APPROVED,
                  deletedAt: {
                    $eq: null,
                  },
                },
              });

              if (friend) return user;
              user.name = 'Unknown Myrian';
              user.username = 'unknow_myrian';
              return user;
            }

            return user;
          }),
        );
      }

      case ControllerType.EXPERIENCE: {
        return result.map((e: Experience) => omit(e, 'posts'));
      }

      default:
        return result;
    }
  }

  private async initializeMeta(
    invocationCtx: InvocationContext,
    filter: Filter<AnyObject>,
    pageDetail: number[],
  ): Promise<MetaPagination> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;
    const {count} = await this.metricService.countData(
      controllerName,
      filter,
      invocationCtx.args[0],
    );

    const meta = pageMetadata([...pageDetail, count]);
    const paginationFilter = Object.assign(filter, {
      offset: ((meta.currentPage ?? 1) - 1) * meta.itemsPerPage,
      limit: meta.itemsPerPage,
    });

    await Promise.all([
      this.finalizeInvocationCtx(invocationCtx, paginationFilter),
      this.additionalMetaInfo(controllerName, meta),
    ]);

    return meta;
  }

  private async additionalMetaInfo(
    controllerName: ControllerType,
    meta: MetaPagination,
  ): Promise<void> {
    if (controllerName !== ControllerType.USEREXPERIENCE) return;
    const {count: totalOwnedExp} = await this.userExperienceService.count({
      userId: this.currentUser[securityId],
      subscribed: false,
    });

    meta.additionalData = {
      totalOwnedExperience: totalOwnedExp,
    };
  }

  private initializeFilter(invocationCtx: InvocationContext): AnyObject {
    const methodName = invocationCtx.methodName as MethodType;
    const arg =
      methodName === MethodType.FINDBYPROFILE
        ? invocationCtx.args[1]
        : invocationCtx.args[0];
    const filter = arg && typeof arg === 'object' ? arg : {where: {}};

    filter.where = {...filter.where};
    return filter;
  }

  private finalizeInvocationCtx(
    invocationCtx: InvocationContext,
    filter: Filter<AnyObject>,
  ): void {
    const controllerName = invocationCtx.targetClass.name as ControllerType;
    const methodName = invocationCtx.methodName as MethodType;
    const index = this.filterArgIndex(controllerName, methodName);

    invocationCtx.args[index] = filter;
  }

  private filterArgIndex(
    controllerName: ControllerType,
    methodName: MethodType,
  ): number {
    if (
      controllerName === ControllerType.REPORTUSER ||
      controllerName === ControllerType.USERWALLET ||
      controllerName === ControllerType.EXPERIENCEPOST ||
      controllerName === ControllerType.POSTEXPERIENCE
    ) {
      return 1;
    }

    if (methodName === MethodType.FINDBYPROFILE) {
      return 1;
    }

    if (methodName === MethodType.GETIMPORTERS) return 2;
    return 0;
  }
}
