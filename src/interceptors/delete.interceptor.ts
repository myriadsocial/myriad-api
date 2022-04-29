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
import {AnyObject, repository} from '@loopback/repository';
import {UserProfile} from '@loopback/security';
import {ControllerType, ReferenceType, SectionType} from '../enums';
import {
  CommentLinkRepository,
  CommentRepository,
  ExperienceRepository,
  PostRepository,
  UserExperienceRepository,
  UserRepository,
  VoteRepository,
  WalletRepository,
} from '../repositories';
import {
  FriendService,
  MetricService,
  NotificationService,
  ReportService,
  VoteService,
} from '../services';
import {CommentWithRelations} from '../models';
import {omit} from 'lodash';
import {HttpErrors} from '@loopback/rest';
import {User} from '@sentry/node';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: DeleteInterceptor.BINDING_KEY}})
export class DeleteInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${DeleteInterceptor.name}`;

  constructor(
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @repository(CommentLinkRepository)
    protected commentLinkRepository: CommentLinkRepository,
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(UserExperienceRepository)
    protected userExperienceRepository: UserExperienceRepository,
    @repository(VoteRepository)
    protected voteRepository: VoteRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
    @service(FriendService)
    protected friendService: FriendService,
    @service(MetricService)
    protected metricService: MetricService,
    @service(ReportService)
    protected reportService: ReportService,
    @service(NotificationService)
    protected notificationService: NotificationService,
    @service(VoteService)
    protected voteService: VoteService,
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
    const controllerName = invocationCtx.targetClass.name as ControllerType;

    await this.beforeDelete(invocationCtx);
    await next();
    await this.afterDelete(invocationCtx);
    if (controllerName === ControllerType.COMMENT) return invocationCtx.args[1];
  }

  async beforeDelete(invocationCtx: InvocationContext): Promise<void> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;

    switch (controllerName) {
      case ControllerType.FRIEND: {
        await this.friendService.removedFriend(invocationCtx.args[1]);
        break;
      }

      case ControllerType.REPORT: {
        const id = invocationCtx.args[0];
        const reportRepos = this.reportService.reportRepository;
        const {referenceId, referenceType} = await reportRepos.findById(id);
        await this.reportService.updateReport(referenceId, referenceType, true);
        invocationCtx.args[1] = {referenceId, referenceType};
        break;
      }

      case ControllerType.WALLET: {
        const {userId, primary} = invocationCtx.args[1];
        const {count} = await this.walletRepository.count({userId});

        if (count === 1) {
          throw new HttpErrors.UnprocessableEntity(
            'You cannot delete your only wallet',
          );
        }

        if (primary) {
          throw new HttpErrors.UnprocessableEntity(
            'You cannot delete your primary account',
          );
        }
        break;
      }
    }
  }

  async afterDelete(invocationCtx: InvocationContext): Promise<void> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;

    switch (controllerName) {
      case ControllerType.COMMENT: {
        const comment: CommentWithRelations = invocationCtx.args[1];
        const {referenceId, postId, post} = comment;
        const promises = [
          this.metricService.countPopularPost(postId),
          this.metricService.publicMetric(ReferenceType.COMMENT, referenceId),
        ];

        if (post?.metric) {
          const metric = post.metric;
          const [countDebate, countDiscussion] = await Promise.all([
            this.metricService.countComment([postId], SectionType.DEBATE),
            this.metricService.countComment([postId], SectionType.DISCUSSION),
          ]);

          promises.push(
            this.metricService.publicMetric(
              ReferenceType.POST,
              postId,
              false,
              countDiscussion,
              countDebate,
            ),
          );

          post.metric = {
            ...metric,
            discussions: countDiscussion,
            debates: countDebate,
            comments: countDiscussion + countDebate,
          };
        } else {
          promises.push(
            this.metricService.publicMetric(ReferenceType.POST, postId),
          );
        }

        Promise.allSettled(promises) as Promise<AnyObject>;

        invocationCtx.args[1] = {
          ...invocationCtx.args[1],
          deletedAt: new Date().toString(),
          deleteByUser: true,
          post: post,
        };
        return;
      }

      case ControllerType.EXPERIENCEPOST: {
        const [experienceId, postId] = invocationCtx.args;
        const {id, experienceIndex} = await this.postRepository.findById(
          postId,
        );
        return this.postRepository.updateById(id, {
          experienceIndex: omit(experienceIndex, [experienceId]),
        });
      }

      case ControllerType.FRIEND: {
        const {requestee, requestor} = invocationCtx.args[1];
        const {friendIndex: requestorFriendIndex} = requestor as User;
        const {friendIndex: requesteeFriendIndex} = requestee as User;

        Promise.allSettled([
          this.metricService.userMetric(requestee.id),
          this.metricService.userMetric(requestor.id),
          this.userRepository.updateById(requestor.id, {
            friendIndex: omit(requestorFriendIndex, [requestee.id]),
          }),
          this.userRepository.updateById(requestee.id, {
            friendIndex: omit(requesteeFriendIndex, [requestor.id]),
          }),
          this.notificationService.cancelFriendRequest(
            requestor.id,
            requestee.id,
          ),
        ]) as Promise<AnyObject>;
        return;
      }

      case ControllerType.POST: {
        const [id, post] = invocationCtx.args;

        Promise.allSettled([
          this.commentRepository.deleteAll({postId: id}),
          this.commentRepository.deleteAll({postId: id}),
          this.metricService.countTags(post.tags),
        ]) as Promise<AnyObject>;
        return;
      }

      case ControllerType.REPORT: {
        const reportRepository = this.reportService.reportRepository;
        await reportRepository.deleteAll(invocationCtx.args[1]);
        return;
      }

      case ControllerType.USEREXPERIENCE: {
        // Update experience subscribed count
        // Removing experience when subscribed count zero
        const promises: Promise<void>[] = [];
        const expRepos = this.experienceRepository;
        const userRepos = this.userRepository;
        const userExpRepos = this.userExperienceRepository;
        const {userId, experienceId, experienceCreator} = invocationCtx.args[3];
        const {count: subscribedCount} = await userExpRepos.count({
          experienceId,
          subscribed: true,
        });

        if (subscribedCount === 0 && userId === experienceCreator) {
          promises.push(expRepos.deleteById(experienceId));
        } else {
          const {count: clonedCount} = await userExpRepos.count({
            clonedId: experienceId,
          });
          const trendCount = subscribedCount + clonedCount;
          promises.push(
            expRepos.updateById(experienceId, {subscribedCount, trendCount}),
          );
        }

        // Update onTimeline for user
        const {count: countUserExperience} = await userExpRepos.count({userId});

        if (countUserExperience === 0) {
          promises.push(userRepos.updateById(userId, {onTimeline: undefined}));
        } else {
          const user = await userRepos.findOne({where: {id: userId}});

          if (experienceId === user?.onTimeline?.toString()) {
            const userExperience = await userExpRepos.findOne({
              where: {userId},
            });

            if (userExperience) {
              const onTimeline = userExperience.experienceId;
              promises.push(userRepos.updateById(userId, {onTimeline}));
            }
          }
        }

        Promise.allSettled(promises) as Promise<AnyObject>;
        return;
      }

      case ControllerType.VOTE: {
        if (!invocationCtx.args[1]) return;
        return this.voteService.updateVoteCounter(invocationCtx.args[1]);
      }
    }
  }

  async removeComment(referenceIds: string[]): Promise<string[] | void> {
    const comments = await this.commentRepository.find({
      where: {
        referenceId: {inq: referenceIds},
      },
    });

    if (comments.length === 0) return;

    const commentIds = comments.map(comment => comment.id ?? '');

    await this.commentRepository.deleteAll({id: {inq: commentIds}});
    await this.commentLinkRepository.deleteAll({
      fromCommentId: {inq: referenceIds},
      toCommentId: {inq: commentIds},
    });

    return this.removeComment(commentIds);
  }
}
