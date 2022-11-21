import {AuthenticationBindings} from '@loopback/authentication';
import {
  inject,
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  ValueOrPromise,
} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {securityId, UserProfile} from '@loopback/security';
import {omit} from 'lodash';
import {
  AccountSettingType,
  ControllerType,
  FriendStatusType,
  MethodType,
  ReferenceType,
} from '../enums';
import {User, UserCurrencyWithRelations} from '../models';
import {
  AccountSettingRepository,
  FriendRepository,
  ReportRepository,
} from '../repositories';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: FindByIdInterceptor.BINDING_KEY}})
export class FindByIdInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${FindByIdInterceptor.name}`;

  constructor(
    @repository(AccountSettingRepository)
    private accountSettingRepository: AccountSettingRepository,
    @repository(FriendRepository)
    private friendRepository: FriendRepository,
    @repository(ReportRepository)
    private reportRepository: ReportRepository,
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

    const afterResult = await this.afterFindById(invocationCtx, result);

    return afterResult;
  }

  async beforeFindById(invocationCtx: InvocationContext): Promise<void> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;

    switch (controllerName) {
      case ControllerType.USERPOST: {
        const filter = invocationCtx.args[1] ?? {};
        const experience = {
          relation: 'experiences',
          scope: {
            limit: 1,
            order: ['name ASC'],
            where: {
              deletedAt: {
                $exists: false,
              },
            },
          },
        };

        filter.include = filter.include
          ? [...filter.include, 'user', experience]
          : ['user', experience];

        invocationCtx.args[1] = filter;
        break;
      }

      case ControllerType.USEREXPERIENCE: {
        const filter = invocationCtx.args[1] ?? {};
        const include = [
          {
            relation: 'experience',
            scope: {
              include: [
                {
                  relation: 'user',
                  scope: {
                    include: [{relation: 'accountSetting'}],
                  },
                },
              ],
            },
          },
        ];

        if (!filter.include) filter.include = include;
        else filter.include.push(...include);

        invocationCtx.args[1] = filter;
        break;
      }
    }
  }

  async afterFindById(
    invocationCtx: InvocationContext,
    result: AnyObject,
  ): Promise<AnyObject> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;
    const methodName = invocationCtx.methodName as MethodType;

    switch (controllerName) {
      case ControllerType.USERCOMMENT: {
        if (result.deletedAt) {
          const report = await this.reportRepository.findOne({
            where: {
              referenceId: result.id,
              referenceType: ReferenceType.COMMENT,
            },
          });

          result.text = '[comment removed]';
          result.reportType = report?.type;
        }

        if (this.currentUser[securityId] === result.userId) return result;
        const accountSetting = await this.accountSettingRepository.findOne({
          where: {
            userId: result.userId,
          },
        });
        if (accountSetting?.accountPrivacy === AccountSettingType.PRIVATE) {
          const friend = await this.friendRepository.findOne({
            where: <AnyObject>{
              requestorId: this.currentUser[securityId],
              requesteeId: result.userId,
              status: FriendStatusType.APPROVED,
              deletedAt: {
                $eq: null,
              },
            },
          });

          if (!friend) {
            result.text = '[This comment is from a private account]';
            result.privacy = 'private';
          }
        }
        return {...result};
      }

      case ControllerType.USER: {
        if (methodName === MethodType.CURRENTUSER) {
          const user = result as User;

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

        if (this.currentUser[securityId] === invocationCtx.args[0]) {
          return {
            ...result,
            status: 'owned',
          };
        }

        const friend = await this.friendRepository.findOne(<AnyObject>{
          where: {
            or: [
              {
                requestorId: this.currentUser[securityId],
                requesteeId: invocationCtx.args[0],
              },
              {
                requesteeId: this.currentUser[securityId],
                requestorId: invocationCtx.args[0],
              },
            ],
          },
        });

        if (!friend) return result;

        const userWithFriendStatus = {
          ...result,
          friendId: friend.id,
          status: friend.status,
        };

        if (friend.status !== FriendStatusType.APPROVED) {
          Object.assign(userWithFriendStatus, {
            requestee: friend.requesteeId,
            requester: friend.requestorId,
          });
        }

        return userWithFriendStatus;
      }

      case ControllerType.USERWALLET: {
        const user = result as User;

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

      default:
        return result;
    }
  }
}
