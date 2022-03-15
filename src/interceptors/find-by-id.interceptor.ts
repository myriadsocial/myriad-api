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
import {
  AccountSettingType,
  ControllerType,
  FriendStatusType,
  PlatformType,
} from '../enums';
import {
  Experience,
  People,
  Post,
  User,
  UserExperienceWithRelations,
} from '../models';
import {omit} from 'lodash';
import {ExperienceService, PostService} from '../services';
import {AccountSettingRepository, FriendRepository} from '../repositories';
import {AuthenticationBindings} from '@loopback/authentication';
import {UserProfile, securityId} from '@loopback/security';
import {HttpErrors} from '@loopback/rest';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: FindByIdInterceptor.BINDING_KEY}})
export class FindByIdInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${FindByIdInterceptor.name}`;

  constructor(
    @repository(AccountSettingRepository)
    protected accountSettingRepository: AccountSettingRepository,
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
    @service(ExperienceService)
    protected experienceService: ExperienceService,
    @service(PostService)
    protected postService: PostService,
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
    await this.beforeFindById(invocationCtx);

    const result = await next();

    return this.afterFindById(invocationCtx, result);
  }

  async beforeFindById(invocationCtx: InvocationContext): Promise<void> {
    const controllerName = invocationCtx.targetClass.name as ControllerType;

    switch (controllerName) {
      case ControllerType.EXPERIENCE: {
        const filter = invocationCtx.args[1] ?? {};
        const include = [
          {
            relation: 'user',
            scope: {
              include: [{relation: 'accountSetting'}],
            },
          },
          {relation: 'users'},
        ];

        if (!filter.include) filter.include = include;
        else filter.include.push(...include);

        invocationCtx.args[1] = filter;
        break;
      }

      case ControllerType.POST: {
        const filter = invocationCtx.args[1] ?? {};

        filter.include = filter.include
          ? [...filter.include, 'user']
          : ['user'];

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

    switch (controllerName) {
      case ControllerType.COMMENT: {
        if (result.deletedAt) result.text = '[comment removed]';
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
                $exists: false,
              },
            },
          });

          if (!friend) result.text = '[This comment is from a private account]';
        }
        return result;
      }

      case ControllerType.EXPERIENCE: {
        if (result.deletedAt)
          throw new HttpErrors.NotFound('Experience not found');
        const users = result.users ?? [];
        const userToPeople = users.map((user: User) => {
          return new People({
            id: user.id,
            name: user.name,
            username: user.username,
            platform: PlatformType.MYRIAD,
            originUserId: user.id,
            profilePictureURL: user.profilePictureURL,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            deletedAt: user.deletedAt,
          });
        });

        result.people = [...result.people, ...userToPeople];

        const privateExperience =
          await this.experienceService.privateExperience(
            this.currentUser[securityId],
            result as Experience,
          );

        return omit(privateExperience, ['users']);
      }

      case ControllerType.POST: {
        if (result.deletedAt || result.banned)
          throw new HttpErrors.NotFound('Post not found');
        const post = await this.postService.restrictedPost(result as Post);
        const postDetail = await this.postService.getPostImporterInfo(
          post,
          this.currentUser[securityId],
        );
        return postDetail;
      }

      case ControllerType.USER: {
        const blockedFriend = await this.friendRepository.findOne({
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
            status: FriendStatusType.BLOCKED,
          },
        });

        if (result.deletedAt) {
          result.name = '[user banned]';
          result.username = '[user banned]';
        }
        if (!blockedFriend) return result;
        return {
          ...result,
          status: 'blocked',
          blocker: blockedFriend.requestorId,
        };
      }

      case ControllerType.USEREXPERIENCE: {
        const userExperiences = this.experienceService.combinePeopleAndUser([
          result,
        ] as UserExperienceWithRelations[]);

        [result] = await this.experienceService.privateUserExperience(
          this.currentUser[securityId],
          userExperiences,
        );

        return result;
      }

      default:
        return result;
    }
  }
}
