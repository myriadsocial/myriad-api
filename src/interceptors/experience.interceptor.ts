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
import {MethodType, PlatformType} from '../enums';
import {People, User} from '../models';
import {
  ExperienceRepository,
  ExperienceUserRepository,
  UserExperienceRepository,
  UserRepository,
} from '../repositories';
import {MetricService} from '../services';
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
    const methodName = invocationCtx.methodName;
    const userId = invocationCtx.args[0];
    const experienceId = invocationCtx.args[1];

    let numberOfUserExperience = 0;
    let people = [];
    let users = [];

    switch (methodName) {
      case MethodType.CREATE: {
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
        numberOfUserExperience = await this.validateCloneExperience(
          userId,
          experienceId,
        );
        break;
      }

      case MethodType.CLONE: {
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

      case MethodType.FINDBYID: {
        invocationCtx.args[1] = Object.assign(invocationCtx.args[1] ?? {}, {
          include: ['users'],
        });
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
      await this.metricService.userMetric(userId);
    } else {
      users = result.users;
      delete result.users;

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
    // Check if experience not belong to user
    const experience = await this.experienceRepository.findById(experienceId);

    if (userId === experience.createdBy)
      throw new HttpErrors.UnprocessableEntity(
        'Experience already belong to you!',
      );

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
}
