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
import {
  ActivityLogType,
  ControllerType,
  MethodType,
  PlatformType,
  ReferenceType,
} from '../enums';
import {UserProfile, securityId} from '@loopback/security';
import {config} from '../config';
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
} from '../repositories';
import {HttpErrors} from '@loopback/rest';
import {Post, User} from '../models';
import {ActivityLogService, CurrencyService} from '../services';
import {UrlUtils} from '../utils/url.utils';

const urlUtils = new UrlUtils();
const {validateURL, getOpenGraph} = urlUtils;

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: UpdateInterceptor.BINDING_KEY}})
export class UpdateInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${UpdateInterceptor.name}`;

  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
    @repository(NotificationRepository)
    protected notificationRepository: NotificationRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
    @repository(UserExperienceRepository)
    protected userExperienceRepository: UserExperienceRepository,
    @repository(UserSocialMediaRepository)
    protected userSocialMediaRepository: UserSocialMediaRepository,
    @service(ActivityLogService)
    protected activityLogService: ActivityLogService,
    @service(CurrencyService)
    protected currencyService: CurrencyService,
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
    if (this.skipUpdate(invocationCtx)) return next();

    let error = false;

    if (!this.currentUser) error = true;

    const isUser = await this.userRepository.findOne({
      where: {id: this.currentUser[securityId]},
    });

    if (!isUser) error = true;
    if (error) {
      throw new HttpErrors.Forbidden('Forbidden user!');
    }

    await this.beforeUpdate(invocationCtx);

    const result = await next();

    return result;
  }

  async beforeUpdate(invocationCtx: InvocationContext): Promise<void> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;
    const methodName = invocationCtx.methodName;

    if (methodName === MethodType.UPDATEEXPERIENCE) {
      invocationCtx.args[2].updatedAt = new Date().toString();
    }

    if (methodName === MethodType.UPDATEBYID) {
      invocationCtx.args[1].updatedAt = new Date();
    }

    let error = false;

    switch (controllerName) {
      case ControllerType.COMMENT: {
        const {userId} = await this.commentRepository.findById(
          invocationCtx.args[0],
        );

        if (userId !== this.currentUser[securityId]) error = true;
        break;
      }

      case ControllerType.CURRENCY: {
        const currency =
          this.currentUser[securityId] ===
          config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY;

        if (!currency) {
          error = true;
          break;
        }

        const currentCurrency =
          await this.currencyService.currencyRepository.findById(
            invocationCtx.args[0],
          );
        const updatedCurrency = Object.assign(
          currentCurrency,
          invocationCtx.args[1],
        );

        invocationCtx.args[1] =
          await this.currencyService.verifyRpcAddressConnection(
            updatedCurrency,
          );

        break;
      }

      case ControllerType.DELETEDCOLLECTION: {
        const admin =
          this.currentUser[securityId] ===
          config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY;

        if (!admin) error = true;
        break;
      }

      case ControllerType.USER: {
        const user = invocationCtx.args[0] === this.currentUser[securityId];

        console.log(invocationCtx.args[0]);
        console.log(this.currentUser[securityId]);

        if (!user) {
          error = true;
          break;
        }

        await this.updateUserProfileActivityLog(
          invocationCtx.args[0],
          invocationCtx.args[1],
        );

        break;
      }

      case ControllerType.NOTIFICATION: {
        if (methodName === MethodType.READNOTIFICATION) {
          const {to} = await this.notificationRepository.findById(
            invocationCtx.args[0],
          );

          if (this.currentUser[securityId] !== to) {
            error = true;
            break;
          }
        }

        if (methodName === MethodType.READMULTIPLENOTIFICATION) {
          const notificationIds = invocationCtx.args[0];

          for (const notificationId of notificationIds) {
            try {
              const {to} = await this.notificationRepository.findById(
                notificationId,
              );

              if (this.currentUser[securityId] !== to) {
                error = true;
                break;
              }
            } catch {
              error = true;
              break;
            }
          }

          break;
        }

        break;
      }

      case ControllerType.POST: {
        const currentPost = await this.postRepository.findById(
          invocationCtx.args[0],
        );
        const payload = invocationCtx.args[1] as Partial<Post>;

        const {createdBy, platform} = currentPost;

        if (createdBy !== this.currentUser[securityId]) {
          error = true;
          break;
        }

        if (
          platform === PlatformType.TWITTER ||
          platform === PlatformType.REDDIT ||
          platform === PlatformType.FACEBOOK
        ) {
          currentPost.updatedAt = payload.updatedAt;

          if (payload.visibility) currentPost.visibility = payload.visibility;
          if (payload.isNSFW) currentPost.isNSFW = payload.isNSFW;
          if (payload.NSFWTag) currentPost.NSFWTag = payload.NSFWTag;

          const updatedPost: Partial<Post> = currentPost;

          delete updatedPost.id;

          invocationCtx.args[1] = updatedPost;

          break;
        }

        let embeddedURL = null;
        let url = '';

        if (payload.text) {
          const found = payload.text.match(/https:\/\/|http:\/\/|www./g);
          if (found) {
            const index: number = payload.text.indexOf(found[0]);

            for (let i = index; i < payload.text.length; i++) {
              const letter = payload.text[i];

              if (letter === ' ' || letter === '"') break;
              url += letter;
            }
          }

          try {
            if (url) validateURL(url);
            embeddedURL = await getOpenGraph(url);
          } catch {
            // ignore
          }

          if (embeddedURL) {
            payload.embeddedURL = embeddedURL;

            invocationCtx.args[1] = payload;
          }
        }

        break;
      }

      case ControllerType.REPORT: {
        const adminReport =
          this.currentUser[securityId] ===
          config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY;

        if (!adminReport) error = true;
        break;
      }

      case ControllerType.USERNOTIFICATIONSETTING:
      case ControllerType.USERACCOUNTSETTING: {
        const userSetting =
          this.currentUser[securityId] === invocationCtx.args[0];

        if (!userSetting) error = true;
        break;
      }

      case ControllerType.USERCURRENCY: {
        const isUserCurrency =
          this.currentUser[securityId] === invocationCtx.args[0];

        if (!isUserCurrency) {
          error = true;
          break;
        }

        const userId = invocationCtx.args[0];
        const currencyId = invocationCtx.args[1];

        await this.currencyService.currencyRepository.findById(currencyId);

        const userCurrency =
          await this.currencyService.userCurrencyRepository.findOne({
            where: {userId, currencyId},
          });

        if (!userCurrency) {
          throw new HttpErrors.UnprocessableEntity(
            "You don't have this currency",
          );
        }

        break;
      }

      case ControllerType.USEREXPERIENCE: {
        const isUserExperience =
          this.currentUser[securityId] === invocationCtx.args[0];

        if (!isUserExperience) {
          error = true;
          break;
        }

        if (methodName === MethodType.SELECTEXPERIENCE) {
          const userId = invocationCtx.args[0];
          const experienceId = invocationCtx.args[1];

          await this.experienceRepository.findById(experienceId);

          const userExperience = await this.userExperienceRepository.findOne({
            where: {userId, experienceId},
          });

          if (!userExperience) {
            throw new HttpErrors.UnprocessableEntity(
              "You don't have this experience",
            );
          }
        }

        break;
      }

      case ControllerType.USERSOCIALMEDIA: {
        const {userId} = await this.userSocialMediaRepository.findById(
          invocationCtx.args[0],
        );

        if (this.currentUser[securityId] !== userId) error = true;
        break;
      }

      case ControllerType.FRIEND: {
        const {requesteeId} = await this.friendRepository.findById(
          invocationCtx.args[0],
        );

        if (this.currentUser[securityId] !== requesteeId) error = true;
        break;
      }
    }

    if (error) {
      throw new HttpErrors.Forbidden('Forbidden user!');
    }
  }

  skipUpdate(invocationCtx: InvocationContext): boolean {
    let skip = true;

    const methodName = invocationCtx.methodName;

    switch (methodName) {
      case MethodType.UPDATEEXPERIENCE:
      case MethodType.SELECTCURRENCY:
      case MethodType.SELECTEXPERIENCE:
      case MethodType.READNOTIFICATION:
      case MethodType.READMULTIPLENOTIFICATION:
      case MethodType.RECOVERPOST:
      case MethodType.RECOVERUSER:
      case MethodType.UPDATEPRIMARY:
      case MethodType.UPDATEBYID:
        skip = false;
        break;

      default:
        skip = true;
    }

    return skip;
  }

  async updateUserProfileActivityLog(
    userId: string,
    user: Partial<User>,
  ): Promise<void> {
    if (user.username) {
      throw new HttpErrors.UnprocessableEntity('Cannot update username');
    }

    if (user.profilePictureURL) {
      await this.activityLogService.createLog(
        ActivityLogType.UPLOADPROFILEPICTURE,
        userId,
        userId,
        ReferenceType.USER,
      );
    }

    if (user.bannerImageUrl) {
      await this.activityLogService.createLog(
        ActivityLogType.UPLOADBANNER,
        userId,
        userId,
        ReferenceType.USER,
      );
    }

    if (user.bio) {
      await this.activityLogService.createLog(
        ActivityLogType.FILLBIO,
        userId,
        userId,
        ReferenceType.USER,
      );
    }
  }
}
