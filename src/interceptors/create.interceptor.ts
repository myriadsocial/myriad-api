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
import {Comment, Credential, DraftPost, Transaction, Wallet} from '../models';
import {
  CommentRepository,
  ExperiencePostRepository,
  ReportRepository,
  UserReportRepository,
  UserRepository,
  WalletRepository,
} from '../repositories';
import {
  ActivityLogService,
  CurrencyService,
  FriendService,
  MetricService,
  NetworkService,
  NotificationService,
  PostService,
  TagService,
  VoteService,
} from '../services';
import {validateAccount} from '../utils/validate-account';

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
    @service(NetworkService)
    protected networkService: NetworkService,
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

      case ControllerType.FRIEND: {
        await this.friendService.handlePendingBlockedRequest(
          invocationCtx.args[0],
        );

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

      case ControllerType.USERWALLET: {
        const [userId, credential] = invocationCtx.args;
        const {data, walletType, networkType} = credential as Credential;

        if (!data) {
          throw new HttpErrors.UnprocessableEntity('Data cannot be empty');
        }

        const networkExists =
          await this.networkService.networkRepository.exists(networkType);

        if (!networkExists) {
          throw new HttpErrors.UnprocessableEntity('Network not exists');
        }

        if (!data.id) {
          throw new HttpErrors.UnprocessableEntity('Id must included');
        }

        const walletExists = await this.walletRepository.exists(data.id);

        if (walletExists)
          throw new HttpErrors.UnprocessableEntity('Wallet Id already exist');

        const wallet = await this.walletRepository.findOne({
          where: {
            type: walletType,
            userId: userId,
          },
        });

        if (wallet) {
          throw new HttpErrors.UnprocessableEntity('Wallet already connected');
        }

        const verified = validateAccount(credential);

        if (!verified) {
          throw new HttpErrors.UnprocessableEntity('Failed to verify');
        }

        invocationCtx.args[1].data = new Wallet({
          ...data,
          userId: userId,
          primary: false,
          network: networkType,
          type: walletType,
        });

        break;
      }

      case ControllerType.NETWORKCURRENCY: {
        const [id, rawCurrency] = invocationCtx.args;
        const {rpcURL} = await this.networkService.networkRepository.findById(
          id,
        );

        invocationCtx.args[1] = await this.networkService.verifyContractAddress(
          id,
          rpcURL,
          rawCurrency.referenceId,
        );

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

      case ControllerType.USERWALLET: {
        const {userId} = invocationCtx.args[1].data;
        const ng = new NonceGenerator();
        const newNonce = ng.generate();

        await this.userRepository.updateById(userId, {nonce: newNonce});

        return result;
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
