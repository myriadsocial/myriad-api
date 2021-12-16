import {
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  service,
  ValueOrPromise,
} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {
  ActivityLogType,
  MethodType,
  PlatformType,
  ReferenceType,
} from '../enums';
import {People, User} from '../models';
import {
  ExperienceRepository,
  ExperienceUserRepository,
  UserExperienceRepository,
  UserRepository,
} from '../repositories';
import {ActivityLogService, MetricService} from '../services';
/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: ExperienceInterceptor.BINDING_KEY}})
export class ExperienceInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${ExperienceInterceptor.name}`;

  constructor(
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
    @repository(UserExperienceRepository)
    protected userExperienceRepository: UserExperienceRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(ExperienceUserRepository)
    protected experienceUserRepository: ExperienceUserRepository,
    @service(MetricService)
    protected metricService: MetricService,
    @service(ActivityLogService)
    protected activityLogService: ActivityLogService,
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
    let userId = invocationCtx.args[0];

    const experienceId = invocationCtx.args[1];
    const methodName = invocationCtx.methodName;
    const userExperienceId = invocationCtx.args[0];

    let numberOfUserExperience = 0;
    let people = [];
    let users = [];
    let isBelongToUser = false;

    switch (methodName) {
      case MethodType.CREATE: {
        if (invocationCtx.args[1].people.length === 0) {
          throw new HttpErrors.UnprocessableEntity('People cannot be empty!');
        }

        people = invocationCtx.args[1].people.filter(
          (e: People) => e.platform !== PlatformType.MYRIAD,
        );
        users = invocationCtx.args[1].people.filter(
          (e: People) => e.platform === PlatformType.MYRIAD,
        );

        numberOfUserExperience = await this.validateNumberOfUserExperience(
          userId,
        );
        invocationCtx.args[1] = Object.assign(invocationCtx.args[1], {
          createdBy: userId,
          people: people,
        });
        break;
      }

      case MethodType.SUBSCRIBE: {
        const {createdBy} = await this.experienceRepository.findById(
          experienceId,
        );
        const found = await this.userExperienceRepository.findOne({
          where: {
            userId: userId,
            experienceId: experienceId,
          },
        });

        if (found && userId === createdBy) {
          throw new HttpErrors.UnprocessableEntity(
            'You already belong this experience!',
          );
        }

        if (userId === createdBy) isBelongToUser = true;

        numberOfUserExperience = await this.validateCloneExperience(
          userId,
          experienceId,
        );
        break;
      }

      case MethodType.CLONE: {
        if (invocationCtx.args[2].people.length === 0) {
          throw new HttpErrors.UnprocessableEntity('People cannot be empty!');
        }

        people = invocationCtx.args[2].people.filter(
          (e: People) => e.platform !== PlatformType.MYRIAD,
        );
        users = invocationCtx.args[2].people.filter(
          (e: People) => e.platform === PlatformType.MYRIAD,
        );

        invocationCtx.args[2] = Object.assign(invocationCtx.args[2], {
          createdBy: userId,
          subscribedCount: 0,
          people: people,
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
        });
        break;
      }

      case MethodType.UPDATEEXPERIENCE: {
        if (invocationCtx.args[2].people.length === 0) {
          throw new HttpErrors.UnprocessableEntity('People cannot be empty!');
        }

        await this.validateUpdateExperience(userId, experienceId);
        await this.experienceUserRepository.deleteAll({
          experienceId: experienceId,
        });

        people = invocationCtx.args[2].people.filter(
          (e: People) => e.platform !== PlatformType.MYRIAD,
        );
        users = invocationCtx.args[2].people.filter(
          (e: People) => e.platform === PlatformType.MYRIAD,
        );

        invocationCtx.args[2] = Object.assign(invocationCtx.args[2], {
          people: people,
        });

        break;
      }

      case MethodType.DELETEBYID: {
        // Reassign userId to recounting userMetric
        ({userId} = await this.userExperienceRepository.findById(
          userExperienceId,
        ));
        break;
      }

      case MethodType.FINDBYID: {
        const filter = invocationCtx.args[1] ?? {};

        if (!filter.include) filter.include = ['users'];
        else filter.include.push('users');

        invocationCtx.args[1] = filter;
        break;
      }
    }

    // Add pre-invocation logic here
    const result = await next();
    // Add post-invocation logic here

    if (
      (methodName === MethodType.CREATE ||
        methodName === MethodType.SUBSCRIBE) &&
      numberOfUserExperience === 0
    ) {
      await this.userRepository.updateById(userId, {
        onTimeline:
          methodName === MethodType.CREATE ? result.id : result.experienceId,
      });
    }

    if (
      methodName === MethodType.SUBSCRIBE ||
      methodName === MethodType.CLONE
    ) {
      const {count: currentNumberOfUserExperience} =
        await this.userExperienceRepository.count({
          experienceId,
          subscribed: true,
        });

      await this.experienceRepository.updateById(experienceId, {
        subscribedCount: currentNumberOfUserExperience,
      });
    }

    if (
      (methodName === MethodType.CREATE ||
        methodName === MethodType.CLONE ||
        methodName === MethodType.UPDATEEXPERIENCE) &&
      users.length > 0
    ) {
      await Promise.all(
        users.map(async (user: User) => {
          return this.experienceUserRepository.create({
            userId: user.id,
            experienceId:
              methodName === MethodType.UPDATEEXPERIENCE
                ? experienceId
                : result.id,
          });
        }),
      );
    }

    if (methodName === MethodType.CLONE) {
      const user = await this.userRepository.findById(userId);

      if (user.onTimeline === experienceId) {
        await this.userRepository.updateById(userId, {onTimeline: result.id});
      }
    }

    if (methodName !== MethodType.FINDBYID) {
      if (methodName === MethodType.CREATE || methodName === MethodType.CLONE) {
        await this.activityLogService.createLog(
          ActivityLogType.CREATEEXPERIENCE,
          result.createdBy,
          result.id,
          ReferenceType.EXPERIENCE,
        );
      }

      if (methodName === MethodType.SUBSCRIBE) {
        if (isBelongToUser) {
          await this.userExperienceRepository.updateById(result.id, {
            subscribed: false,
          });
        } else {
          await this.activityLogService.createLog(
            ActivityLogType.SUBSCRIBEEXPERIENCE,
            result.userId,
            result.experienceId,
            ReferenceType.EXPERIENCE,
          );
        }
      }

      // Recounting userMetric after create, clone, and subscribe
      await this.metricService.userMetric(userId);
    } else {
      if (result.users) {
        users = result.users;
        delete result.users;
      }

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
        });
      });

      result.people = [...result.people, ...userToPeople];
    }

    return result;
  }

  async validateCloneExperience(
    userId: string,
    experienceId: string,
  ): Promise<number> {
    // Check if user has been subscribed this experience
    const subscribed = await this.userExperienceRepository.findOne({
      where: {userId, experienceId, subscribed: true},
    });

    if (subscribed)
      throw new HttpErrors.UnprocessableEntity(
        'You already subscribed this experience!',
      );

    return this.validateNumberOfUserExperience(userId);
  }

  async validateNumberOfUserExperience(userId: string): Promise<number> {
    // Check if user has experiences less than equal 10
    const {count} = await this.userExperienceRepository.count({userId});

    if (count >= 10)
      throw new HttpErrors.UnprocessableEntity(
        'Experience must not exceed 10 experiences',
      );

    return count;
  }

  async validateUpdateExperience(
    userId: string,
    experienceId: string,
  ): Promise<void> {
    const userExperience = await this.userExperienceRepository.findOne({
      where: {
        userId,
        experienceId,
      },
      include: ['experience'],
    });

    if (!userExperience)
      throw new HttpErrors.UnprocessableEntity('Experience not found');

    if (userExperience.subscribed)
      throw new HttpErrors.UnprocessableEntity(
        'You cannot update other user experience',
      );

    if (
      userExperience.experience &&
      userExperience.experience.createdBy !== userId
    )
      throw new HttpErrors.UnprocessableEntity(
        'You cannot update other user experience',
      );
  }
}
