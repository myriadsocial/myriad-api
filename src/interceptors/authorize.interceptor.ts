import {
  inject,
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  ValueOrPromise,
} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  CommentRepository,
  FriendRepository,
  NotificationRepository,
  PostRepository,
  UserExperienceRepository,
  UserRepository,
  UserSocialMediaRepository,
  VoteRepository,
} from '../repositories';
import {UserProfile, securityId} from '@loopback/security';
import {AuthenticationBindings} from '@loopback/authentication';
import {ControllerType, FriendStatusType, MethodType} from '../enums';
import {config} from '../config';
import {HttpErrors} from '@loopback/rest';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: AuthorizeInterceptor.BINDING_KEY}})
export class AuthorizeInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${AuthorizeInterceptor.name}`;

  constructor(
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
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
      case MethodType.CREATEVOTE:
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
        else ({userId} = await this.commentRepository.findById(data));
        break;
      }

      case ControllerType.CURRENCY:
      case ControllerType.TAG:
      case ControllerType.REPORT:
      case ControllerType.PEOPLE:
        userId = config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY;
        break;

      case ControllerType.FRIEND: {
        if (typeof data === 'object') {
          const status = data.status;
          if (status !== FriendStatusType.APPROVED) {
            userId = data.requestorId;
          }
        } else {
          const friend = await this.friendRepository.findById(data);
          if (methodName === MethodType.DELETEBYID) {
            userId = friend.requestorId;
          } else {
            userId = friend.requesteeId;
          }
        }
        break;
      }

      case ControllerType.NOTIFICATION: {
        if (typeof data === 'string') userId = data;
        else {
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

          invocationCtx.args[2] = post;
          userId = post.createdBy;
        }
        break;

      case ControllerType.USERDRAFTPOST:
      case ControllerType.STORAGECONTROLLER:
      case ControllerType.TIPCONTROLLER:
      case ControllerType.USERACCOUNTSETTING:
      case ControllerType.USERNOTIFICATIONSETTING:
      case ControllerType.USERREPORT:
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
        if (typeof data === 'object') userId = data.publicKey;
        else {
          ({userId} = await this.userSocialMediaRepository.findById(data));
        }
        break;
      }

      case ControllerType.VOTE:
        if (typeof data === 'object') {
          userId = data.userId;
        } else {
          ({userId} = await this.voteRepository.findById(data));
        }
        break;
    }

    let error = false;

    if (!userId) error = true;
    if (userId !== this.currentUser[securityId]) error = true;
    if (error) {
      throw new HttpErrors.Unauthorized('Unauthorized user!');
    }
  }
}
