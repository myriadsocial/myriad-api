import {
  AuthenticationBindings,
  AuthenticationMetadata,
} from '@loopback/authentication';
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
import {HttpErrors, RestBindings} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {intersection} from 'lodash';
import {config} from '../config';
import {
  ControllerType,
  FriendStatusType,
  MethodType,
  PermissionKeys,
} from '../enums';
import {
  ExperienceRepository,
  ExperienceEditorRepository,
  FriendRepository,
  PostRepository,
  WalletRepository,
} from '../repositories';
import {PolkadotJs} from '../utils/polkadot-js';

const {getKeyring, getHexPublicKey} = new PolkadotJs();

export interface RequiredPermissions {
  required: PermissionKeys[];
}

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@globalInterceptor('', {tags: {name: 'authorize'}})
export class AuthorizeInterceptor implements Provider<Interceptor> {
  constructor(
    @repository(ExperienceRepository)
    private experienceRepository: ExperienceRepository,
    @repository(ExperienceEditorRepository)
    private experienceEditorRepository: ExperienceEditorRepository,
    @repository(FriendRepository)
    private friendRepository: FriendRepository,
    @repository(PostRepository)
    private postRepository: PostRepository,
    @repository(WalletRepository)
    private walletRepository: WalletRepository,
    @inject(AuthenticationBindings.METADATA)
    private metadata: AuthenticationMetadata[],
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
    if (!this.metadata) return next();
    const request = await invocationCtx.get(RestBindings.Http.REQUEST);

    if (request.method === 'GET') return next();
    if (request.method === 'PATCH') {
      const methodName = invocationCtx.methodName as MethodType;
      if (methodName === MethodType.UPDATEBYID) {
        invocationCtx.args[1].updatedAt = new Date().toString();
      }
    }
    await this.authorize(invocationCtx);

    return next();
  }

  async authorize(invocationCtx: InvocationContext): Promise<void> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;
    const methodName = invocationCtx.methodName as MethodType;
    const data = invocationCtx.args[0];

    let userId = null;

    switch (controllerName) {
      case ControllerType.SERVER:
      case ControllerType.REPORT: {
        userId = await this.admin();
        break;
      }

      case ControllerType.EXPERIENCEPOST: {
        if (methodName === MethodType.DELETE) return;
        const {experienceIds} = invocationCtx.args[0];
        const counts = await Promise.all([
          this.experienceRepository.count({
            id: {inq: experienceIds},
            createdBy: this.currentUser[securityId],
          }),
          this.experienceEditorRepository.count({
            experienceId: {inq: experienceIds},
            userId: this.currentUser[securityId],
          }),
        ]);
        const count = counts[0].count + counts[1].count;
        if (count === experienceIds.length) return;
        userId = null;
        break;
      }

      case ControllerType.USER: {
        if (methodName.endsWith('Admin')) {
          userId = await this.admin(methodName);
          break;
        }

        return;
      }

      case ControllerType.USERFRIEND: {
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
            if (this.currentUser[securityId] === friend.requestorId) {
              userId = friend.requestorId;
            }

            if (this.currentUser[securityId] === friend.requesteeId) {
              userId = friend.requesteeId;
            }

            invocationCtx.args[1] = friend;
          } else {
            userId = friend.requesteeId;
            invocationCtx.args[1] = friend;
          }
        }
        break;
      }

      case ControllerType.USERUNLOCKABLECONTENT:
      case ControllerType.USERCLAIMREFERENCE:
      case ControllerType.USERCOMMENT:
      case ControllerType.USERNOTIFICATION:
      case ControllerType.USERSETTING:
      case ControllerType.STORAGE:
      case ControllerType.VIDEOUPLOAD:
      case ControllerType.USERCURRENCY:
      case ControllerType.USEREXPERIENCE:
      case ControllerType.USERNETWORK:
      case ControllerType.USERPERSONALACCESSTOKEN:
      case ControllerType.USERSOCIALMEDIA:
      case ControllerType.USERREPORT:
      case ControllerType.USERWALLET:
      case ControllerType.USERVOTE: {
        return;
      }

      case ControllerType.USERTRANSACTION: {
        if (methodName === MethodType.PATCH) return;
        const user = await this.walletRepository.user(data.from);
        userId = user.id;
        break;
      }

      case ControllerType.USERPOST: {
        if (typeof data === 'object') return;
        if (methodName !== MethodType.DELETEBYID) return;
        const post = await this.postRepository.findById(data);

        invocationCtx.args[1] = post;
        userId = post.createdBy;
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

  async admin(methodName?: MethodType): Promise<string> {
    const keyring = getKeyring().addFromMnemonic(
      config.MYRIAD_ADMIN_SUBSTRATE_MNEMONIC,
    );
    const adminAddress = getHexPublicKey(keyring);
    const wallet = await this.walletRepository.findOne({
      where: {id: adminAddress},
    });

    if (wallet && this.currentUser[securityId] === wallet.userId) {
      return wallet.userId;
    }

    const options = this.metadata?.[0].options ?? {};
    const requiredPermissions = options as RequiredPermissions;
    const user = this.currentUser;
    const permissions = user.permissions;
    const required = requiredPermissions?.required ?? [];
    const exists = intersection(permissions, required).length;

    if (exists <= 0) throw new HttpErrors.Forbidden('Invalid access');
    if (
      requiredPermissions.required !== undefined &&
      exists !== requiredPermissions.required.length
    ) {
      throw new HttpErrors.Forbidden('Invalid access');
    }
    if (methodName?.endsWith('Admin')) {
      const found = user.permissions.find(
        (permission: PermissionKeys) => permission === PermissionKeys.MASTER,
      );
      if (!found) {
        throw new HttpErrors.Forbidden(
          'Only master admin can create/remove role',
        );
      }
    }

    return this.currentUser[securityId];
  }
}
