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
  ReportStatusType,
} from '../enums';
import {AnyObject, repository} from '@loopback/repository';
import {
  CurrencyRepository,
  ExperienceRepository,
  ExperienceUserRepository,
  NetworkRepository,
  ReportRepository,
  UserExperienceRepository,
  UserRepository,
  WalletRepository,
} from '../repositories';
import {HttpErrors} from '@loopback/rest';
import {Credential, People, Post, User, Wallet} from '../models';
import {
  ActivityLogService,
  CurrencyService,
  ExperienceService,
  FriendService,
  MetricService,
  NotificationService,
  ReportService,
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
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
    @repository(ExperienceUserRepository)
    protected experienceUserRepository: ExperienceUserRepository,
    @repository(ReportRepository)
    protected reportRepository: ReportRepository,
    @repository(UserExperienceRepository)
    protected userExperienceRepository: UserExperienceRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
    @repository(NetworkRepository)
    protected networkRepository: NetworkRepository,
    @service(ActivityLogService)
    protected activityLogService: ActivityLogService,
    @service(ExperienceService)
    protected experienceService: ExperienceService,
    @service(CurrencyService)
    protected currencyService: CurrencyService,
    @service(FriendService)
    protected friendService: FriendService,
    @service(MetricService)
    protected metricService: MetricService,
    @service(NotificationService)
    protected notificationService: NotificationService,
    @service(ReportService)
    protected reportService: ReportService,
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
          const importedPayload: AnyObject = {
            updatedAt: new Date().toString(),
          };

          if (payload.visibility)
            importedPayload.visibility = payload.visibility;
          if (payload.isNSFW) importedPayload.isNSFW = payload.isNSFW;
          if (payload.NSFWTag) importedPayload.NSFWTag = payload.NSFWTag;

          invocationCtx.args[1] = importedPayload;

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
        const [reportId, report] = invocationCtx.args;
        const {referenceId, referenceType} =
          await this.reportRepository.findById(reportId);

        if (report.status === ReportStatusType.REMOVED) {
          await this.reportService.updateReport(
            referenceId,
            referenceType,
            false,
          );
        }

        break;
      }

      case ControllerType.USERCURRENCY: {
        const {networkId, currencyIds} = invocationCtx.args[0];
        const [{count: countCurrency}, {count: countCurrencyNetwork}] =
          await Promise.all([
            this.currencyRepository.count({id: {inq: currencyIds}, networkId}),
            this.currencyRepository.count({networkId}),
          ]);

        if (
          countCurrency !== currencyIds.length ||
          countCurrencyNetwork !== currencyIds.length
        ) {
          throw new HttpErrors.UnprocessableEntity('Total currency not match');
        }

        break;
      }

      case ControllerType.USEREXPERIENCE: {
        const [userId, experienceId, experience] = invocationCtx.args;
        const rawPeople = experience.people as People[];

        if (rawPeople.length === 0) {
          throw new HttpErrors.UnprocessableEntity('People cannot be empty!');
        }

        await Promise.all([
          this.experienceService.validateUpdateExperience(userId, experienceId),
          this.experienceUserRepository.deleteAll({experienceId}),
        ]);

        const people = rawPeople.filter(
          e => e.platform !== PlatformType.MYRIAD,
        );
        invocationCtx.args[3] = rawPeople.filter(
          e => e.platform === PlatformType.MYRIAD,
        );

        Object.assign(invocationCtx.args[2], {people});

        break;
      }

      case ControllerType.USERNETWORK: {
        const [userId, credential] = invocationCtx.args;
        const {networkType: networkId} = credential as Credential;
        const [publicAddress, near] = credential.publicAddress.split('/');
        const [_, wallet] = await Promise.all([
          this.networkRepository.findById(networkId),
          this.walletRepository.findOne({
            where: {
              id: near ?? publicAddress,
              userId: userId,
            },
          }),
        ]);

        if (!wallet) {
          throw new HttpErrors.UnprocessableEntity('Wallet not connected');
        }

        if (wallet.id !== (near ?? publicAddress)) {
          throw new HttpErrors.UnprocessableEntity('Wrong address');
        }

        if (wallet.networkId === networkId && wallet.primary === true) {
          throw new HttpErrors.UnprocessableEntity('Network already connected');
        }

        const verified = validateAccount(assign(credential, {publicAddress}));

        if (!verified) {
          throw new HttpErrors.UnprocessableEntity('Failed to verify');
        }

        wallet.networkId = networkId;
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
        const {requestor, requestee} = invocationCtx.args[2];
        const {friendIndex: requestorFriendIndex} = requestor as User;
        const {friendIndex: requesteeFriendIndex} = requestee as User;

        Promise.allSettled([
          this.notificationService.sendFriendAccept(requestor.id),
          this.metricService.userMetric(requestor.id),
          this.metricService.userMetric(requestee.id),
          this.userRepository.updateById(requestor.id, {
            friendIndex: {
              ...requestorFriendIndex,
              [requestee.id]: 1,
            },
          }),
          this.userRepository.updateById(requestee.id, {
            friendIndex: {
              ...requesteeFriendIndex,
              [requestor.id]: 1,
            },
          }),
        ]) as Promise<AnyObject>;
        break;
      }

      case ControllerType.USEREXPERIENCE: {
        const [userId, experienceId] = invocationCtx.args;
        const users = invocationCtx.args[3] ?? [];
        if (users.length > 0) {
          Promise.allSettled([
            this.metricService.userMetric(userId),
            ...users.map((user: User) => {
              return this.experienceUserRepository.create({
                userId: user.id,
                experienceId,
              });
            }),
          ]) as Promise<AnyObject>;
        }
        break;
      }

      case ControllerType.USERNETWORK: {
        const {networkId, userId} = invocationCtx.args[1].data as Wallet;
        const ng = new NonceGenerator();
        const newNonce = ng.generate();

        await this.currencyService.updateUserCurrency(userId, networkId);
        Promise.allSettled([
          this.userRepository.updateById(userId, {nonce: newNonce}),
          this.walletRepository.updateAll(
            {primary: false},
            {networkId: {nin: [networkId]}, userId},
          ),
        ]) as Promise<AnyObject>;

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

    if (user.bannerImageURL) {
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
