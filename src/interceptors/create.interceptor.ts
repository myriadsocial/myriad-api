import {
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  service,
  ValueOrPromise,
} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import NonceGenerator from 'a-nonce-generator';
import {
  ReferenceType,
  ControllerType,
  PostStatus,
  ActivityLogType,
  FriendStatusType,
  PlatformType,
  MethodType,
  VisibilityType,
} from '../enums';
import {
  Comment,
  Credential,
  Experience,
  Friend,
  Transaction,
  User,
  Wallet,
} from '../models';
import {
  ExperienceUserRepository,
  NetworkRepository,
  ReportRepository,
  UserReportRepository,
  UserRepository,
  WalletRepository,
} from '../repositories';
import {
  ActivityLogService,
  CurrencyService,
  ExperienceService,
  FriendService,
  MetricService,
  NetworkService,
  NotificationService,
  PostService,
  SocialMediaService,
  TagService,
  VoteService,
} from '../services';
import {validateAccount} from '../utils/validate-account';
import {intersection} from 'lodash';
import {formatTag} from '../utils/formatted';
import {PlatformPost} from '../models/platform-post.model';
import {ExtendedPost} from '../interfaces';
import {UrlUtils} from '../utils/url.utils';
import {omit} from 'lodash';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: CreateInterceptor.BINDING_KEY}})
export class CreateInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${CreateInterceptor.name}`;

  constructor(
    @repository(ExperienceUserRepository)
    protected experienceUserRepository: ExperienceUserRepository,
    @repository(ReportRepository)
    protected reportRepository: ReportRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(UserReportRepository)
    protected userReportRepository: UserReportRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
    @repository(NetworkRepository)
    protected networkRepository: NetworkRepository,
    @service(MetricService)
    protected metricService: MetricService,
    @service(CurrencyService)
    protected currencyService: CurrencyService,
    @service(ExperienceService)
    protected experienceService: ExperienceService,
    @service(TagService)
    protected tagService: TagService,
    @service(NotificationService)
    protected notificationService: NotificationService,
    @service(ActivityLogService)
    protected activityLogService: ActivityLogService,
    @service(VoteService)
    protected voteService: VoteService,
    @service(FriendService)
    protected friendService: FriendService,
    @service(PostService)
    protected postService: PostService,
    @service(NetworkService)
    protected networkService: NetworkService,
    @service(SocialMediaService)
    protected socialMediaService: SocialMediaService,
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
    try {
      const controllerName = invocationCtx.targetClass.name as ControllerType;

      await this.beforeCreate(invocationCtx);

      if (controllerName === ControllerType.USERWALLET) {
        const [_, {data}, connected] = invocationCtx.args;
        if (connected) return data;
      }

      const result = await next();

      return await this.afterCreate(invocationCtx, result);
    } catch (err) {
      const controllerName = invocationCtx.targetClass.name as ControllerType;
      if (controllerName === ControllerType.VOTE) {
        if (err.message === 'CommentFirst') {
          throw new HttpErrors.UnprocessableEntity(
            'Please comment first in debate sections, before you downvote this post',
          );
        }
      } else {
        throw err;
      }
    }
  }

  async beforeCreate(invocationCtx: InvocationContext): Promise<void> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;

    switch (controllerName) {
      case ControllerType.TRANSACTION: {
        const transaction: Transaction = invocationCtx.args[0];
        const {from, to, type, currencyId, referenceId} = transaction;
        if (from === to) {
          throw new HttpErrors.UnprocessableEntity(
            'From and to address cannot be the same!',
          );
        }

        if (type === ReferenceType.POST || type === ReferenceType.COMMENT) {
          if (!referenceId) {
            throw new HttpErrors.UnprocessableEntity(
              'Please insert referenceId',
            );
          }
        }

        await this.currencyService.currencyRepository.findById(currencyId);
        return;
      }

      case ControllerType.COMMENT: {
        const {postId} = invocationCtx.args[0] as Comment;
        await this.postService.postRepository.findById(postId);

        return;
      }

      case ControllerType.FRIEND: {
        const friend = invocationCtx.args[0] as Friend;
        await this.friendService.handlePendingBlockedRequest(friend);

        return;
      }

      case ControllerType.VOTE: {
        const voteDetail = invocationCtx.args[0];
        const type = voteDetail.type;

        await this.voteService.validateVote(voteDetail);

        if (type === ReferenceType.POST) voteDetail.section = undefined;

        invocationCtx.args[0] = voteDetail;

        break;
      }

      case ControllerType.TAG: {
        const id = invocationCtx.args[0].id
          .toLowerCase()
          .split(/ +/gi)[0]
          .replace(/[^A-Za-z0-9]/gi, '')
          .trim();
        const tag = await this.tagService.tagRepository.findOne({where: {id}});

        if (tag) throw new HttpErrors.UnprocessableEntity('Tag already exist');

        Object.assign(invocationCtx.args[0], {id});

        break;
      }

      case ControllerType.EXPERIENCEPOST: {
        const [data, postId] = invocationCtx.args;
        const param = typeof data === 'string' ? [data] : undefined;

        await this.experienceService.removeExperiencePost(postId, param);

        break;
      }

      case ControllerType.USEREXPERIENCE: {
        return this.beforeHandleExperience(invocationCtx);
      }

      case ControllerType.USERWALLET: {
        const [userId, credential] = invocationCtx.args;
        const {data, networkType} = credential as Credential;
        const {id} = data;

        if (!data) {
          throw new HttpErrors.UnprocessableEntity('Data cannot be empty');
        }

        if (!id) {
          throw new HttpErrors.UnprocessableEntity('Id must included');
        }

        const networkExists = await this.networkRepository.exists(networkType);

        if (!networkExists) {
          throw new HttpErrors.UnprocessableEntity('Network not exists');
        }

        const wallet = await this.walletRepository.findOne({
          where: {id},
        });

        if (wallet && wallet.userId !== userId) {
          throw new HttpErrors.UnprocessableEntity(
            'Already belong to other user',
          );
        }

        const verified = validateAccount(credential);

        if (!verified) {
          throw new HttpErrors.UnprocessableEntity('Failed to verify');
        }

        invocationCtx.args[2] = wallet ? true : false;
        invocationCtx.args[1].data = new Wallet({
          ...data,
          userId: userId,
          primary: false,
          networkId: networkType,
        });

        break;
      }

      case ControllerType.NETWORKCURRENCY: {
        const [id, rawCurrency] = invocationCtx.args;
        const {rpcURL} = await this.networkRepository.findById(id);

        invocationCtx.args[1] = await this.networkService.verifyContractAddress(
          id,
          rpcURL,
          rawCurrency.referenceId,
        );

        break;
      }

      case ControllerType.POST: {
        if (invocationCtx.methodName !== MethodType.IMPORT) return;
        const urlUtils = new UrlUtils(invocationCtx.args[0].url);
        const pathname = urlUtils.getPathname();
        const platform = urlUtils.getPlatform();
        const originPostId = urlUtils.getOriginPostId();
        const platformPost = Object.assign(invocationCtx.args[0], {
          url: [platform, originPostId].join(','),
        });

        await this.postService.validateImportedPost(platformPost);

        const rawPost = await this.getSocialMediaPost(platformPost, pathname);

        invocationCtx.args[0].rawPost = rawPost;
        return;
      }

      default:
        return;
    }
  }

  async afterCreate(
    invocationCtx: InvocationContext,
    result: AnyObject,
  ): Promise<AnyObject> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;

    switch (controllerName) {
      case ControllerType.TRANSACTION: {
        Promise.allSettled([
          this.createNotification(controllerName, result),
          this.metricService.publicMetric(
            ReferenceType.POST,
            result.referenceId,
          ),
          this.activityLogService.createLog(
            ActivityLogType.SENDTIP,
            result.from,
            ReferenceType.TRANSACTION,
          ),
        ]) as Promise<AnyObject>;
        return result;
      }

      case ControllerType.POST: {
        return this.afterHandlePost(invocationCtx, result);
      }

      case ControllerType.COMMENT: {
        const {referenceId, postId} = result as Comment;

        Promise.allSettled([
          this.createNotification(controllerName, result),
          this.metricService.countPopularPost(postId),
          this.metricService.publicMetric(ReferenceType.POST, postId),
          this.metricService.publicMetric(ReferenceType.COMMENT, referenceId),
          this.activityLogService.createLog(
            ActivityLogType.CREATECOMMENT,
            result.userId,
            ReferenceType.COMMENT,
          ),
        ]) as Promise<AnyObject>;

        return result;
      }

      case ControllerType.FRIEND: {
        if (result && result.status === FriendStatusType.PENDING) {
          Promise.allSettled([
            this.createNotification(controllerName, result),
            this.activityLogService.createLog(
              ActivityLogType.FRIENDREQUEST,
              result.requesteeId,
              ReferenceType.USER,
            ),
          ]) as Promise<AnyObject>;
        }

        if (result && result.status === FriendStatusType.BLOCKED) {
          const {requesteeId, requestorId} = result as Friend;

          Promise.allSettled([
            this.userRepository
              .findById(requestorId)
              .then(({friendIndex: requestorFriendIndex}) => {
                return this.userRepository.updateById(requestorId, {
                  friendIndex: omit(requestorFriendIndex, [requesteeId]),
                });
              }),
            this.userRepository
              .findById(requesteeId)
              .then(({friendIndex: requesteeFriendIndex}) => {
                return this.userRepository.updateById(requesteeId, {
                  friendIndex: omit(requesteeFriendIndex, [requestorId]),
                });
              }),
          ]) as Promise<AnyObject>;
        }

        return result;
      }

      case ControllerType.USEREXPERIENCE: {
        return this.afterHandleExperience(invocationCtx, result);
      }

      case ControllerType.USERREPORT: {
        const reportDetail = invocationCtx.args[1];

        this.userReportRepository
          .findOne({
            where: {
              reportId: result.id,
              reportedBy: invocationCtx.args[0],
            },
          })
          .then(userReport => {
            if (userReport) return;
            return this.userReportRepository.create({
              referenceType: reportDetail.referenceType,
              description: reportDetail.description,
              reportedBy: invocationCtx.args[0],
              reportId: result.id,
            });
          })
          .then(userReport => {
            if (!userReport) return {count: 0};
            return this.userReportRepository.count({
              reportId: result.id.toString(),
            });
          })
          .then(({count}) => {
            return this.reportRepository.updateById(result.id, {
              totalReported: count,
              status: result.status,
            });
          }) as Promise<void>;

        return result;
      }

      case ControllerType.USERWALLET: {
        const {userId, networkId} = invocationCtx.args[1].data as Wallet;
        const ng = new NonceGenerator();
        const newNonce = ng.generate();

        Promise.allSettled([
          this.currencyService.addUserCurrencies(userId, networkId),
          this.userRepository.updateById(userId, {nonce: newNonce}),
        ]) as Promise<AnyObject>;

        return result;
      }

      case ControllerType.VOTE: {
        const {_id: id, referenceId, type} = result.value;
        const creator: Promise<string> = new Promise(resolve => {
          if (type === ReferenceType.POST) {
            this.postService.postRepository
              .findById(referenceId)
              .then(({createdBy}) => {
                resolve(createdBy);
              })
              .catch(() => resolve(''));
          } else {
            this.voteService.commentRepository
              .findById(referenceId)
              .then(({userId}) => {
                resolve(userId);
              })
              .catch(() => resolve(''));
          }
        });

        Object.assign(result.value, {
          id: id,
          _id: undefined,
        });

        Promise.allSettled([
          creator.then(toUserId => {
            return this.voteService.updateVoteCounter(result.value, toUserId);
          }),
          this.activityLogService.createLog(
            ActivityLogType.GIVEVOTE,
            referenceId,
            type,
          ),
        ]) as Promise<AnyObject>;

        return result.value;
      }

      default:
        return result;
    }
  }

  async beforeHandleExperience(
    invocationCtx: InvocationContext,
  ): Promise<void> {
    const data: AnyObject = {};
    const expService = this.experienceService;
    const methodName = invocationCtx.methodName;

    switch (methodName) {
      case MethodType.CREATE: {
        const [userId, experience] = invocationCtx.args as [string, Experience];
        const tagExperience = experience.allowedTags.filter(e => e !== '');
        const prohibitedTags = experience.prohibitedTags;
        const intersectionTags = intersection(tagExperience, prohibitedTags);
        const expPeople = experience.people.filter(e => {
          if (
            e.id === '' ||
            e.name === '' ||
            e.username === '' ||
            !e.platform
          ) {
            return false;
          }

          const platforms = [
            PlatformType.MYRIAD,
            PlatformType.REDDIT,
            PlatformType.TWITTER,
          ];

          if (platforms.includes(e.platform)) return true;
          return false;
        });
        if (expPeople.length === 0) {
          throw new HttpErrors.UnprocessableEntity('People cannot be empty!');
        }
        if (tagExperience.length === 0) {
          throw new HttpErrors.UnprocessableEntity('Tags cannot be empty!');
        }
        if (intersectionTags.length > 0) {
          throw new HttpErrors.UnprocessableEntity(
            'You cannot insert same hashtag in allowed and prohibited tags',
          );
        }

        data.users = expPeople.filter(e => e.platform === PlatformType.MYRIAD);
        data.totalExp = await expService.validateNumberOfUserExperience(userId);

        Object.assign(invocationCtx.args[1], {
          createdBy: userId,
          people: expPeople.filter(e => e.platform !== PlatformType.MYRIAD),
          allowedTags: tagExperience.map(tag => formatTag(tag)),
        });
        break;
      }

      case MethodType.SUBSCRIBE: {
        const [userId, experienceId] = invocationCtx.args as [string, string];
        const userExpRepos = expService.userExperienceRepository;
        const userExperience = await userExpRepos.findOne({
          where: {userId, experienceId},
          include: ['experience'],
        });

        const experienceCreator = userExperience?.experience?.createdBy;
        if (userExperience && userId === experienceCreator) {
          throw new HttpErrors.UnprocessableEntity(
            'You already belong this experience!',
          );
        }

        if (userId === experienceCreator) data.isBelongToUser = true;

        data.totalExp = await expService.validateSubscribeExperience(
          userId,
          experienceId,
        );
        break;
      }

      default:
        throw new HttpErrors.UnprocessableEntity('Unknown method');
    }

    invocationCtx.args[3] = data;
  }

  async afterHandleExperience(
    invocationCtx: InvocationContext,
    result: AnyObject,
  ): Promise<AnyObject> {
    const userId = invocationCtx.args[0];
    const {users, totalExp, isBelongToUser} = invocationCtx.args[3];
    const userRepos = this.userRepository;
    const expRepos = this.experienceService.experienceRepository;
    const expUserRepos = this.experienceUserRepository;
    const userExpRepos = this.experienceService.userExperienceRepository;
    const methodName = invocationCtx.methodName;
    const promises: Promise<AnyObject | void>[] = [
      this.metricService.userMetric(userId),
    ];

    switch (methodName) {
      case MethodType.CREATE: {
        const createdExperience = result as Experience;
        const allowedTags = createdExperience.allowedTags;
        const prohibitedTags = createdExperience.prohibitedTags;
        const tags = [...allowedTags, ...prohibitedTags];
        const clonedId = invocationCtx.args[2];
        const expId = result.id.toString();

        promises.push(
          this.tagService.createTags(tags, true),
          this.activityLogService.createLog(
            ActivityLogType.CREATEEXPERIENCE,
            result.id,
            ReferenceType.EXPERIENCE,
          ),
        );

        if (clonedId) {
          promises.push(
            userExpRepos
              .updateAll({clonedId}, {userId, experienceId: expId})
              .then(() =>
                Promise.all([
                  userExpRepos.count({clonedId}),
                  userExpRepos.count({
                    experienceId: clonedId,
                    subscribed: true,
                  }),
                ]),
              )
              .then(([{count: clonedCount}, {count: subscribedCount}]) => {
                const trendCount = clonedCount + subscribedCount;
                return expRepos.updateById(clonedId, {clonedCount, trendCount});
              }),
          );
        }

        if (totalExp === 0) {
          promises.push(userRepos.updateById(userId, {onTimeline: expId}));
        }

        if (users.length > 0) {
          users.forEach((user: User) => {
            promises.push(
              expUserRepos.create({userId: user.id, experienceId: expId}),
            );
          });
        }
        break;
      }

      case MethodType.SUBSCRIBE: {
        const experienceId = invocationCtx.args[1];
        if (totalExp === 0) {
          const onTimeline = result.experienceId;
          promises.push(userRepos.updateById(userId, {onTimeline}));
        }

        const subscribed = !isBelongToUser;
        if (isBelongToUser) {
          promises.push(userExpRepos.updateById(result.id, {subscribed}));
          Object.assign(result, {subscribed});
        } else {
          promises.push(
            Promise.all([
              userExpRepos.count({experienceId, subscribed}),
              userExpRepos.count({clonedId: experienceId}),
            ]).then(([{count: subscribedCount}, {count: clonedCount}]) => {
              const trendCount = subscribedCount + clonedCount;
              return expRepos.updateById(experienceId, {
                subscribedCount,
                trendCount,
              });
            }),
            this.activityLogService.createLog(
              ActivityLogType.SUBSCRIBEEXPERIENCE,
              result.experienceId,
              ReferenceType.EXPERIENCE,
            ),
          );
        }

        break;
      }

      default:
        throw new HttpErrors.UnprocessableEntity('Unknown method');
    }

    Promise.allSettled(promises) as Promise<AnyObject>;

    return result;
  }

  async afterHandlePost(
    invocationCtx: InvocationContext,
    result: AnyObject,
  ): Promise<AnyObject> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;
    const methodName = invocationCtx.methodName;

    switch (methodName) {
      case MethodType.CREATE: {
        if (result.status === PostStatus.DRAFT) return result;

        const rawPost = omit(result, ['status']);
        const published = await this.postService.postRepository.create(rawPost);
        const {createdBy: userId, tags} = published;

        Promise.allSettled([
          this.postService.draftPostRepository.delete(userId),
          this.tagService.createTags(tags),
          this.createNotification(controllerName, published),
          this.metricService.userMetric(userId),
          this.metricService.countServerMetric(),
          this.activityLogService.createLog(
            ActivityLogType.CREATEPOST,
            userId,
            ReferenceType.POST,
          ),
        ]) as Promise<AnyObject>;

        return published;
      }

      case MethodType.IMPORT: {
        const importer = invocationCtx.args[0].importer;
        const [user, {count}] = await Promise.all([
          this.userRepository.findOne({where: {id: importer}}),
          this.postService.postRepository.count({
            originPostId: result.originPostId,
            platform: result.platform,
            banned: false,
            deletedAt: {exists: false},
          }),
        ]);

        Promise.allSettled([
          this.tagService.createTags(result.tags),
          this.activityLogService.createLog(
            ActivityLogType.IMPORTPOST,
            result.createdBy,
            result.id,
          ),
        ]) as Promise<AnyObject>;

        return {
          ...result,
          importers: user ? [Object.assign(user, {name: 'You'})] : [],
          totalImporter: count,
        };
      }

      default:
        throw new HttpErrors.UnprocessableEntity('Invalid method');
    }
  }

  async getSocialMediaPost(
    platformPost: PlatformPost,
    pathname = '',
  ): Promise<ExtendedPost> {
    const [platform, originPostId] = platformPost.url.split(',');

    let rawPost = null;
    switch (platform) {
      case PlatformType.TWITTER:
        rawPost = await this.socialMediaService.fetchTweet(originPostId);
        break;

      case PlatformType.REDDIT:
        rawPost = await this.socialMediaService.fetchRedditPost(
          originPostId,
          pathname,
        );
        break;

      default:
        throw new HttpErrors.BadRequest('Cannot find the platform!');
    }

    if (!rawPost) {
      throw new HttpErrors.BadRequest('Cannot find the specified post');
    }

    rawPost.visibility = platformPost.visibility ?? VisibilityType.PUBLIC;
    rawPost.tags = this.getImportedTags(rawPost.tags, platformPost.tags ?? []);
    rawPost.createdBy = platformPost.importer;
    rawPost.isNSFW = Boolean(platformPost.NSFWTag);
    rawPost.NSFWTag = platformPost.NSFWTag;

    return rawPost;
  }

  getImportedTags(socialTags: string[], importedTags: string[]): string[] {
    if (!socialTags) socialTags = [];
    if (!importedTags) importedTags = [];

    const postTags = [...socialTags, ...importedTags]
      .map(tag => formatTag(tag))
      .filter(tag => Boolean(tag));

    return [...new Set(postTags)];
  }

  async createNotification(
    controllerName: ControllerType,
    result: AnyObject,
  ): Promise<void> {
    switch (controllerName) {
      case ControllerType.COMMENT:
        return this.notificationService.sendPostComment(result as Comment);

      case ControllerType.FRIEND:
        return this.notificationService.sendFriendRequest(result.requesteeId);

      case ControllerType.TRANSACTION:
        return this.notificationService.sendTipsSuccess(result as Transaction);

      case ControllerType.POST:
        return this.notificationService.sendMention(
          result.id,
          result.mentions ?? [],
        );
    }
  }
}
