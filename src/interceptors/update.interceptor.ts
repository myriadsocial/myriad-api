import {
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
import {repository} from '@loopback/repository';
import {ExperienceRepository, UserExperienceRepository} from '../repositories';
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
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
    @repository(UserExperienceRepository)
    protected userExperienceRepository: UserExperienceRepository,
    @service(ActivityLogService)
    protected activityLogService: ActivityLogService,
    @service(CurrencyService)
    protected currencyService: CurrencyService,
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
    await this.beforeUpdate(invocationCtx);

    return next();
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

    switch (controllerName) {
      case ControllerType.CURRENCY: {
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

      case ControllerType.USER: {
        await this.updateUserProfileActivityLog(
          invocationCtx.args[0],
          invocationCtx.args[1],
        );

        break;
      }

      case ControllerType.POST: {
        const payload = invocationCtx.args[1] as Partial<Post>;
        const currentPost = invocationCtx.args[2] as Post;

        if (!currentPost) {
          throw new HttpErrors.Forbidden('Forbidden user!');
        }

        const {platform} = currentPost;

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

      case ControllerType.USERCURRENCY: {
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
    }
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
