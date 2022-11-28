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
import {securityId, UserProfile} from '@loopback/security';
import {omit} from 'lodash';
import {
  ControllerType,
  MethodType,
  ReferenceType,
  VisibilityType,
} from '../enums';
import {
  CommentWithRelations,
  Post,
  UserCurrencyWithRelations,
  UserWithRelations,
} from '../models';
import {ReportRepository} from '../repositories';
import {FilterBuilderService, FriendService, UserService} from '../services';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: FindByIdInterceptor.BINDING_KEY}})
export class FindByIdInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${FindByIdInterceptor.name}`;

  constructor(
    @repository(ReportRepository)
    private reportRepository: ReportRepository,
    @service(FilterBuilderService)
    private filterBuilderService: FilterBuilderService,
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
    await this.beforeFindById(invocationCtx);

    const result = await next();

    const afterResult = await this.afterFindById(result, invocationCtx);

    return afterResult;
  }

  async beforeFindById(invocationCtx: InvocationContext): Promise<void> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;

    switch (controllerName) {
      case ControllerType.USERPOST: {
        return this.filterBuilderService.userPostById(invocationCtx.args);
      }

      case ControllerType.USEREXPERIENCE:
        return this.filterBuilderService.userExperienceById(invocationCtx.args);

      default:
        return;
    }
  }

  async afterFindById(
    result: AnyObject,
    invocationCtx: InvocationContext,
  ): Promise<AnyObject> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;
    const methodName = invocationCtx.methodName as MethodType;
    const currentUserId = this.currentUser[securityId];

    switch (controllerName) {
      case ControllerType.USER: {
        const user = result as UserWithRelations;

        if (methodName === MethodType.CURRENTUSER) {
          if (user?.userCurrencies) {
            const userCurrencies =
              user.userCurrencies as UserCurrencyWithRelations[];
            const currencies = userCurrencies.map(e => e.currency);

            return {
              ...omit(user, ['userCurrencies']),
              currencies,
            };
          }

          return user;
        }

        const userId = invocationCtx.args[0];
        if (currentUserId === userId) {
          user.friendInfo = {status: 'owner'};
          return omit(user, ['nonce', 'permissions', 'friendIndex']);
        }

        const info = await this.friendService.getFriendInfo(
          currentUserId,
          userId,
        );
        if (!info) return user;
        user.friendInfo = info;
        return user;
      }

      case ControllerType.USERCOMMENT: {
        const comment = result as CommentWithRelations;

        if (currentUserId !== comment.userId) {
          const contents = comment.lockableContents;
          if (contents && contents.length > 0) {
            const lockableContents = contents.map(content => {
              const paidUserIds = content.paidUserIds;
              const hasPaid = paidUserIds?.find(id => id === currentUserId);
              if (hasPaid) return omit(content, ['paidUserIds']);
              return omit(content, ['paidUserIds', 'content']);
            });

            comment.lockableContents = lockableContents;
          }
        }

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

          return comment;
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

          return comment;
        }

        // Check comment creator privacy when post creator is current user
        if (currentUserId === post.createdBy) {
          if (currentUserId === userId) return comment;
          const isPrivate = await this.userService.isAccountPrivate(userId);
          if (isPrivate) {
            comment.text = '[This comment is from a private account]';
            comment.privacy = 'private';
          }

          return comment;
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

          return comment;
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

          return comment;
        }

        // Post creator is not current user
        // Check comment creator privacy when post visibility is public
        const isPrivate = await this.userService.accountSetting(userId);
        if (isPrivate) {
          comment.text = '[This comment is from a private account]';
          comment.privacy = 'private';
        }

        return comment;
      }

      case ControllerType.USERPOST: {
        const post = result as Post;
        if (currentUserId === post.createdBy) return post;
        const contents = post.lockableContents;
        if (contents && contents.length > 0) {
          const lockableContents = contents.map(content => {
            const paidUserIds = content.paidUserIds;
            const hasPaid = paidUserIds?.find(id => id === currentUserId);
            if (hasPaid) return omit(content, ['paidUserIds']);
            return omit(content, ['paidUserIds', 'content']);
          });

          post.lockableContents = lockableContents;
        }

        return post;
      }

      default:
        return result;
    }
  }
}
