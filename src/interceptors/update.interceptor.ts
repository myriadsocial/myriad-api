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
  FriendStatusType,
  MethodType,
  PlatformType,
  ReferenceType,
} from '../enums';
import {repository} from '@loopback/repository';
import {
  ExperienceRepository,
  UserExperienceRepository,
  UserRepository,
  WalletRepository,
} from '../repositories';
import {HttpErrors} from '@loopback/rest';
import {Credential, Post, User} from '../models';
import {
  ActivityLogService,
  CurrencyService,
  FriendService,
  MetricService,
  NotificationService,
} from '../services';
import {UrlUtils} from '../utils/url.utils';
import {validateAccount} from '../utils/validate-account';
import {assign} from 'lodash';
import NonceGenerator from 'a-nonce-generator';

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
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
    @service(ActivityLogService)
    protected activityLogService: ActivityLogService,
    @service(CurrencyService)
    protected currencyService: CurrencyService,
    @service(FriendService)
    protected friendService: FriendService,
    @service(MetricService)
    protected metricService: MetricService,
    @service(NotificationService)
    protected notificationService: NotificationService,
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

    await this.beforeUpdate(invocationCtx);

    const result = await next();

    await this.afterUpdate(invocationCtx);

    return controllerName === ControllerType.USERNETWORK
      ? invocationCtx.args[1].data
      : result;
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
        const [currencyId, currency] = invocationCtx.args;
        const currentCurrency =
          await this.currencyService.currencyRepository.findById(currencyId);
        const updatedCurrency = Object.assign(currentCurrency, {
          ...currency,
          updatedAt: new Date().toString(),
        });

        invocationCtx.args[1] =
          await this.currencyService.verifyRpcAddressConnection(
            updatedCurrency,
          );

        break;
      }

      case ControllerType.FRIEND: {
        const status = invocationCtx.args[1].status;

        if (status !== FriendStatusType.APPROVED) {
          throw new HttpErrors.UnprocessableEntity(
            'Only accept approved friend request!',
          );
        }

        await this.friendService.validateApproveFriendRequest(
          invocationCtx.args[2],
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

      case ControllerType.USERNETWORK: {
        const [userId, credential] = invocationCtx.args;
        const {networkType: networkId, walletType} = credential as Credential;
        const [publicAddress, nearAccount] =
          credential.publicAddress.split('/');

        // TODO: validate network

        const wallet = await this.walletRepository.findOne({
          where: {
            type: walletType,
            userId: userId,
          },
        });

        if (!wallet) {
          throw new HttpErrors.UnprocessableEntity('Wallet not connected');
        }

        if (wallet.id !== (nearAccount ?? publicAddress)) {
          throw new HttpErrors.UnprocessableEntity('Wrong address');
        }

        if (wallet.network === networkId) {
          throw new HttpErrors.UnprocessableEntity('Network already connected');
        }

        const verified = validateAccount(assign(credential, {publicAddress}));

        if (!verified) {
          throw new HttpErrors.UnprocessableEntity('Failed to verify');
        }

        const network = wallet.networks.find(e => e === networkId);

        if (!network) {
          wallet.networks.push(networkId);
        }

        wallet.network = networkId;
        wallet.primary = true;
        invocationCtx.args[1].data = wallet;

        break;
      }
    }
  }

  async afterUpdate(invocationCtx: InvocationContext): Promise<void> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;

    switch (controllerName) {
      case ControllerType.FRIEND: {
        const {requestorId, requesteeId} = invocationCtx.args[2];
        await this.notificationService.sendFriendAccept(requestorId);
        await this.metricService.userMetric(requestorId);
        await this.metricService.userMetric(requesteeId);
        break;
      }

      case ControllerType.USERCURRENCY: {
        const {userId, currencies} = invocationCtx.args[0];

        await this.userRepository.updateById(userId, {
          defaultCurrency: currencies[0],
        });

        break;
      }

      case ControllerType.USERNETWORK: {
        const {id, network, userId} = invocationCtx.args[1].data;
        const ng = new NonceGenerator();
        const newNonce = ng.generate();

        await this.userRepository.updateById(userId, {nonce: newNonce});
        await this.walletRepository.updateAll(
          {primary: false},
          {network: {nin: [network]}, userId: id},
        );

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
        ReferenceType.USER,
      );
    }

    if (user.bannerImageUrl) {
      await this.activityLogService.createLog(
        ActivityLogType.UPLOADBANNER,
        userId,
        ReferenceType.USER,
      );
    }

    if (user.bio) {
      await this.activityLogService.createLog(
        ActivityLogType.FILLBIO,
        userId,
        ReferenceType.USER,
      );
    }
  }
}
