import {
  globalInterceptor,
  inject,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  ValueOrPromise,
} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  CommentRepository,
  ExperienceRepository,
  FriendRepository,
  NotificationRepository,
  PostRepository,
  UserExperienceRepository,
  UserRepository,
  UserSocialMediaRepository,
  VoteRepository,
  WalletRepository,
} from '../repositories';
import {UserProfile, securityId} from '@loopback/security';
import {
  AuthenticationBindings,
  AuthenticationMetadata,
} from '@loopback/authentication';
import {
  ControllerType,
  FriendStatusType,
  MethodType,
  PermissionKeys,
} from '../enums';
import {HttpErrors} from '@loopback/rest';
import {RequiredPermissions} from '../interfaces';
import {intersection} from 'lodash';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
// @injectable({tags: {key: AuthorizeInterceptor.BINDING_KEY}})
@globalInterceptor('', {tags: {name: 'authorize'}})
export class AuthorizeInterceptor implements Provider<Interceptor> {
  // static readonly BINDING_KEY = `interceptors.${AuthorizeInterceptor.name}`;

  constructor(
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(NotificationRepository)
    protected notificationRepository: NotificationRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(UserExperienceRepository)
    protected userExperienceRepository: UserExperienceRepository,
    @repository(UserSocialMediaRepository)
    protected userSocialMediaRepository: UserSocialMediaRepository,
    @repository(VoteRepository)
    protected voteRepository: VoteRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
    @inject(AuthenticationBindings.METADATA)
    public metadata: AuthenticationMetadata[],
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    public currentUser: UserProfile,
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
    if (!this.metadata) return next();
    if (!this.selectMethod(invocationCtx)) return next();
    await this.authorize(invocationCtx);

    return next();
  }

  selectMethod(invocationCtx: InvocationContext): boolean {
    const methodName = invocationCtx.methodName as MethodType;

    switch (methodName) {
      case MethodType.CREATE:
      case MethodType.IMPORT:
      case MethodType.FILEUPLOAD:
      case MethodType.CLAIMTIPS:
      case MethodType.SUBSCRIBE:
      case MethodType.UPDATEBYID:
      case MethodType.PATCH:
      case MethodType.READNOTIFICATION:
      case MethodType.READMULTIPLENOTIFICATION:
      case MethodType.SELECTCURRENCY:
      case MethodType.SELECTEXPERIENCE:
      case MethodType.UPDATEEXPERIENCE:
      case MethodType.UPDATEPRIMARY:
      case MethodType.DELETEBYID:
      case MethodType.RESTORE:
      case MethodType.DELETEDRAFTPOST:
      case MethodType.DELETE:
        return true;

      default:
        return false;
    }
  }

  async authorize(invocationCtx: InvocationContext): Promise<void> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;
    const methodName = invocationCtx.methodName as MethodType;
    const data = invocationCtx.args[0];

    let userId = null;

    switch (controllerName) {
      case ControllerType.COMMENT: {
        if (typeof data === 'object') userId = data.userId;
        else {
          const comment = await this.commentRepository.findById(data, {
            include: ['post'],
          });
          if (methodName === MethodType.DELETEBYID) {
            invocationCtx.args[1] = comment;
          } else {
            invocationCtx.args[2] = comment;
          }
          userId = comment.userId;
        }
        break;
      }

      case ControllerType.ADMIN:
      case ControllerType.CURRENCY:
      case ControllerType.TAG:
      case ControllerType.REPORT:
      case ControllerType.PEOPLE: {
        userId = this.admin(controllerName);
        break;
      }

      case ControllerType.EXPERIENCEPOST:
        ({createdBy: userId} = await this.experienceRepository.findById(data));
        break;

      case ControllerType.FRIEND: {
        if (typeof data === 'object') {
          const status = data.status;
          if (status !== FriendStatusType.APPROVED) {
            userId = data.requestorId;
          }
        } else {
          const friend = await this.friendRepository.findById(data, {
            include: ['requestee', 'requestor'],
          });
          if (methodName === MethodType.DELETEBYID) {
            if (friend.status === FriendStatusType.PENDING) {
              userId = friend.requesteeId;
            } else {
              if (this.currentUser[securityId] === friend.requestorId) {
                userId = friend.requestorId;
              }

              if (this.currentUser[securityId] === friend.requesteeId) {
                userId = friend.requesteeId;
              }
            }

            invocationCtx.args[1] = friend;
          } else {
            userId = friend.requesteeId;
            invocationCtx.args[2] = friend;
          }
        }
        break;
      }

      case ControllerType.NOTIFICATION: {
        if (typeof data === 'string') {
          ({to: userId} = await this.notificationRepository.findById(data));
        } else {
          for (const id of data) {
            ({to: userId} = await this.notificationRepository.findById(id));

            if (userId !== this.currentUser[securityId]) break;
          }
        }
        break;
      }

      case ControllerType.POST:
        if (typeof data === 'object') {
          if (data.importer) userId = data.importer;
          else userId = data.createdBy;
        } else {
          const post = await this.postRepository.findById(data);

          if (methodName === MethodType.DELETEBYID) {
            invocationCtx.args[1] = post;
          } else {
            invocationCtx.args[2] = post;
          }
          userId = post.createdBy;
        }
        break;

      case ControllerType.STORAGE:
      case ControllerType.TIP:
      case ControllerType.USERACCOUNTSETTING:
      case ControllerType.USERDRAFTPOST:
      case ControllerType.USERNETWORK:
      case ControllerType.USERNOTIFICATIONSETTING:
      case ControllerType.USERLANGUAGESETTING:
      case ControllerType.USERREPORT:
      case ControllerType.USERWALLET:
      case ControllerType.USER:
        userId = data;
        break;

      case ControllerType.TRANSACTION:
        userId = data.from;
        break;

      case ControllerType.USERCURRENCY: {
        if (typeof data === 'object') userId = data.userId;
        else userId = data;
        break;
      }

      case ControllerType.USEREXPERIENCE: {
        if (methodName !== MethodType.DELETEBYID) userId = data;
        else {
          ({userId} = await this.userExperienceRepository.findById(data));
        }
        break;
      }

      case ControllerType.USERSOCIALMEDIA: {
        if (typeof data === 'object') {
          const userSocialMedia = await this.walletRepository.user(
            data.publicKey,
          );
          userId = userSocialMedia.id;
        } else {
          ({userId} = await this.userSocialMediaRepository.findById(data));
        }
        break;
      }

      case ControllerType.VOTE: {
        if (typeof data === 'object') {
          userId = data.userId;
        } else {
          ({userId} = await this.voteRepository.findById(data));
        }
        break;
      }
    }

    let error = false;

    if (!userId) error = true;
    if (userId !== this.currentUser[securityId]) error = true;
    if (error) {
      throw new HttpErrors.Unauthorized('Unauthorized user!');
    }
  }

  admin(controllerName?: ControllerType): string {
    const requiredPermissions =
      (this.metadata[0].options as RequiredPermissions) ?? {};
    const user = this.currentUser;
    const result = intersection(
      user.permissions,
      requiredPermissions.required ?? [],
    ).length;
    if (
      requiredPermissions.required !== undefined &&
      result !== requiredPermissions.required.length
    ) {
      throw new HttpErrors.Forbidden('Invalid access');
    }
    if (controllerName === ControllerType.ADMIN) {
      const found = user.permissions.find(
        (permission: PermissionKeys) => permission === PermissionKeys.MASTER,
      );
      if (!found) {
        throw new HttpErrors.Forbidden('Only master admin can create role');
      }
    }

    return this.currentUser[securityId];
  }
}
