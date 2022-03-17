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
} from '../enums';
import {
  Comment,
  Credential,
  DraftPost,
  Transaction,
  UserSocialMedia,
  Wallet,
} from '../models';
import {
  CommentRepository,
  ExperiencePostRepository,
  ReportRepository,
  UserCurrencyRepository,
  UserReportRepository,
  UserRepository,
  WalletRepository,
} from '../repositories';
import {
  ActivityLogService,
  CurrencyService,
  FriendService,
  MetricService,
  NotificationService,
  PostService,
  TagService,
  VoteService,
} from '../services';
import {validateAccount} from '../utils/validate-account';
import {assign} from 'lodash';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: CreateInterceptor.BINDING_KEY}})
export class CreateInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${CreateInterceptor.name}`;

  constructor(
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @repository(UserCurrencyRepository)
    protected userCurrencyRepository: UserCurrencyRepository,
    @repository(ReportRepository)
    protected reportRepository: ReportRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(UserReportRepository)
    protected userReportRepository: UserReportRepository,
    @repository(ExperiencePostRepository)
    protected experiencePostRepository: ExperiencePostRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
    @service(MetricService)
    protected metricService: MetricService,
    @service(CurrencyService)
    protected currencyService: CurrencyService,
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
      await this.beforeCreate(invocationCtx);

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
        if (transaction.from === transaction.to) {
          throw new HttpErrors.UnprocessableEntity(
            'From and to address cannot be the same!',
          );
        }

        if (
          transaction.type === ReferenceType.POST ||
          transaction.type === ReferenceType.COMMENT
        ) {
          if (!transaction.referenceId) {
            throw new HttpErrors.UnprocessableEntity(
              'Please insert referenceId',
            );
          }
        }

        await this.currencyService.currencyRepository.findById(
          transaction.currencyId,
        );
        return;
      }

      case ControllerType.COMMENT: {
        const {postId} = invocationCtx.args[0] as Comment;

        await this.postService.postRepository.findById(postId);

        return;
      }

      case ControllerType.CURRENCY: {
        const data = invocationCtx.args[0];
        const currencyId = data.id;
        const found = await this.currencyService.currencyRepository.findOne({
          where: {id: currencyId},
        });

        if (found)
          throw new HttpErrors.UnprocessableEntity('Currency already exists');

        invocationCtx.args[0] =
          await this.currencyService.verifyRpcAddressConnection(data);

        return;
      }

      case ControllerType.FRIEND: {
        await this.friendService.handlePendingBlockedRequest(
          invocationCtx.args[0],
        );

        return;
      }

      case ControllerType.USERCURRENCY: {
        const {userId, currencyId} = invocationCtx.args[0];

        await this.currencyService.currencyRepository.findById(currencyId);

        const userCurrency = await this.userCurrencyRepository.findOne({
          where: {userId, currencyId},
        });
        if (userCurrency)
          throw new HttpErrors.UnprocessableEntity(
            'User currency already exists',
          );

        const {count} = await this.userCurrencyRepository.count({userId});

        invocationCtx.args[0].currencyId = currencyId;
        invocationCtx.args[0].priority = count + 1;

        return;
      }

      case ControllerType.VOTE: {
        const type = invocationCtx.args[0].type;
        const data: AnyObject = {};

        if (type === ReferenceType.POST) {
          const post = await this.voteService.validatePostVote(
            invocationCtx.args[0],
          );

          data.toUserId = post.createdBy;
          data.section = undefined;
        } else if (type === ReferenceType.COMMENT) {
          const comment = await this.voteService.validateComment(
            invocationCtx.args[0],
          );

          data.toUserId = comment.userId;
        } else throw new HttpErrors.UnprocessableEntity('Type not found');

        invocationCtx.args[0] = Object.assign(invocationCtx.args[0], data);

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

        invocationCtx.args[0] = Object.assign(invocationCtx.args[0], {id});

        break;
      }

      case ControllerType.EXPERIENCEPOST: {
        const [experienceId, postId] = invocationCtx.args;
        const post = await this.postService.postRepository.findById(postId);

        const found = await this.experiencePostRepository.findOne({
          where: {
            postId: postId,
            experienceId: experienceId,
          },
        });

        if (found) {
          throw new HttpErrors.UnprocessableEntity(
            'Already added to experience',
          );
        }
        invocationCtx.args[2] = post?.experienceIndex ?? {};

        break;
      }

      case ControllerType.USERNETWORK: {
        const [userId, credential] = invocationCtx.args;
        const {networkType: networkId, walletType} = credential as Credential;
        const [publicAddress, nearAccount] =
          credential.publicAddress.split('/');

        // TODO: validate network

        const found = await this.walletRepository.findOne({
          where: {
            id: nearAccount ?? publicAddress,
            networks: {inq: [[networkId]]},
            type: walletType,
            userId: userId,
          },
        });

        if (!found) {
          throw new HttpErrors.UnprocessableEntity('Network not connected');
        }

        if (found.network === networkId) {
          throw new HttpErrors.UnprocessableEntity('Network already connected');
        }

        const verified = validateAccount(assign(credential, {publicAddress}));

        if (!verified) {
          throw new HttpErrors.UnprocessableEntity('Failed to verify');
        }

        found.network = networkId;
        found.primary = true;
        invocationCtx.args[2].data = found;

        break;
      }

      case ControllerType.USERWALLET: {
        const [userId, credential] = invocationCtx.args;
        const {data, walletType, networkType} = credential as Credential;

        if (!data) {
          throw new HttpErrors.UnprocessableEntity('Data cannot be empty');
        }

        // TODO: validate network

        if (!data.id) {
          throw new HttpErrors.UnprocessableEntity('Id must included');
        }

        let wallet = await this.walletRepository.findOne({
          where: {
            id: data.id,
            type: walletType,
            userId: userId,
          },
        });

        const hasWallet = Boolean(wallet);

        if (wallet) {
          const found = wallet.networks.find(
            network => network === networkType,
          );

          if (found) {
            throw new HttpErrors.UnprocessableEntity(
              'Wallet already connected',
            );
          }

          if (wallet.id !== data.id) {
            throw new HttpErrors.UnprocessableEntity('Wrong address');
          }

          wallet.primary = true;
          wallet.network = networkType;
          wallet.networks = [...wallet.networks, networkType];
        } else {
          wallet = new Wallet({
            ...data,
            primary: true,
            type: walletType,
            network: networkType,
            networks: [networkType],
            userId: userId,
          });
        }

        const verified = validateAccount(credential);

        if (!verified) {
          throw new HttpErrors.UnprocessableEntity('Failed to verify');
        }

        invocationCtx.args[1].data = assign(wallet, {
          updated: hasWallet ? true : false,
        });

        break;
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
        if (result.status === PostStatus.PUBLISHED) {
          result = await this.postService.createPublishPost(
            result as DraftPost,
          );

          Promise.allSettled([
            this.tagService.createTags(result.tags),
            this.createNotification(controllerName, result),
            this.metricService.userMetric(result.createdBy),
            this.activityLogService.createLog(
              ActivityLogType.CREATEPOST,
              result.createdBy,
              ReferenceType.POST,
            ),
          ]) as Promise<AnyObject>;
        }
        return result;
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
          await this.createNotification(controllerName, result);
          await this.activityLogService.createLog(
            ActivityLogType.FRIENDREQUEST,
            result.requesteeId,
            ReferenceType.USER,
          );
        }

        return result;
      }

      case ControllerType.EXPERIENCEPOST: {
        const [experienceId, postId] = invocationCtx.args;
        const experienceIndex = invocationCtx.args[2] as AnyObject;
        experienceIndex[experienceId] = 1;
        await this.postService.postRepository.updateById(postId, {
          experienceIndex,
        });

        return result;
      }

      case ControllerType.USERNETWORK: {
        const {id, network, userId} = invocationCtx.args[2].data;
        const ng = new NonceGenerator();
        const newNonce = ng.generate();

        await this.userRepository.updateById(userId, {nonce: newNonce});
        await this.walletRepository.updateAll(
          {primary: false},
          {userId: userId},
        );
        await this.walletRepository.updateById(id, {
          network: network,
          primary: true,
        });

        return result;
      }

      case ControllerType.USERWALLET: {
        const {userId} = invocationCtx.args[1].data;
        const ng = new NonceGenerator();
        const newNonce = ng.generate();

        await this.userRepository.updateById(userId, {nonce: newNonce});

        return invocationCtx.args[1].data;
      }

      case ControllerType.USERREPORT: {
        const reportDetail = invocationCtx.args[1];

        const found = await this.userReportRepository.findOne({
          where: {
            reportId: result.id,
            reportedBy: invocationCtx.args[0],
          },
        });

        if (found)
          throw new HttpErrors.UnprocessableEntity(
            'You have report this user/post/comment',
          );

        await this.userReportRepository.create({
          referenceType: reportDetail.referenceType,
          description: reportDetail.description,
          reportedBy: invocationCtx.args[0],
          reportId: result.id,
        });

        const {count} = await this.userReportRepository.count({
          reportId: result.id.toString(),
        });

        await this.reportRepository.updateById(result.id, {
          totalReported: count,
          status: result.status,
        });

        return Object.assign(result, {totalReported: count});
      }

      case ControllerType.USERSOCIALMEDIA: {
        this.currencyService.autoClaimTips(
          result as UserSocialMedia,
        ) as Promise<void>;

        return result;
      }

      case ControllerType.VOTE: {
        const {_id: id, referenceId, type} = result.value;

        await this.voteService.updateVoteCounter(result.value);
        await this.activityLogService.createLog(
          ActivityLogType.GIVEVOTE,
          referenceId,
          type,
        );

        return Object.assign(result.value, {
          id: id,
          _id: undefined,
        });
      }

      default:
        return result;
    }
  }

  async createNotification(
    controllerName: ControllerType,
    result: AnyObject,
  ): Promise<void> {
    try {
      switch (controllerName) {
        case ControllerType.COMMENT: {
          await this.notificationService.sendPostComment(result as Comment);
          break;
        }

        case ControllerType.FRIEND: {
          await this.notificationService.sendFriendRequest(result.requesteeId);
          break;
        }

        case ControllerType.POST: {
          await this.notificationService.sendMention(
            result.id,
            result.mentions ?? [],
          );
          break;
        }

        case ControllerType.TRANSACTION: {
          await this.notificationService.sendTipsSuccess(result as Transaction);
          break;
        }
      }
    } catch {
      // ignore
    }
  }
}
