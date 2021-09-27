import {
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  ValueOrPromise,
} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {MethodType} from '../enums';
import {
  ExperienceRepository,
  UserExperienceRepository,
  UserRepository,
} from '../repositories';
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

    switch (methodName) {
      case MethodType.CREATE:
        numberOfUserExperience = await this.validateNumberOfUserExperience(
          userId,
        );
        invocationCtx.args[1] = Object.assign(invocationCtx.args[1], {
          createdBy: userId,
        });
        break;

      case MethodType.SUBSCRIBE:
        numberOfUserExperience = await this.validateCloneExperience(
          userId,
          experienceId,
        );
        break;

      case MethodType.CLONE:
        invocationCtx.args[2] = Object.assign(invocationCtx.args[2], {
          createdBy: userId,
          subscribedCount: 0,
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
        });
        break;
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

    if (methodName === MethodType.CLONE) {
      const user = await this.userRepository.findById(userId);

      if (user.onTimeline === experienceId) {
        await this.userRepository.updateById(userId, {onTimeline: result.id});
      }
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
