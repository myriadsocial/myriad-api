import {
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  service,
  ValueOrPromise,
} from '@loopback/core';
import {Count, repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import * as _ from 'lodash';
import {MethodType, StatusType} from '../enums';
import {ExperienceRepository, UserExperienceRepository, UserRepository} from '../repositories';
import {ExperienceService} from '../services';
import {setStatus} from '../utils/filter-utils';

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
    @service(ExperienceService)
    protected experienceService: ExperienceService,
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
  async intercept(invocationCtx: InvocationContext, next: () => ValueOrPromise<InvocationResult>) {
    const methodName = invocationCtx.methodName;

    let count = 0;

    switch (methodName) {
      case MethodType.CLONE: {
        const {userId, experienceId} = invocationCtx.args[0];
        const experience = await this.experienceRepository.findById(experienceId);
        const user = await this.userExperienceRepository.count({userId});

        if (user.count >= 10)
          throw new HttpErrors.UnprocessableEntity('Experience must not exceed 10 experiences');
        else count = user.count;

        if (userId === experience.createdBy)
          throw new HttpErrors.UnprocessableEntity('Experience already belong to you!');

        experience.cloned = experience.cloned + 1;
        experience.origin = false;
        experience.clonedFrom = experience.id;
        experience.createdAt = new Date().toString();
        experience.updatedAt = new Date().toString();

        const newExperience = await this.experienceRepository.create(_.omit(experience, 'id'));

        const result = await this.experienceRepository.count({
          clonedFrom: experience.id,
        });

        this.experienceRepository.updateAll(
          {cloned: result.count},
          {
            or: [
              {
                clonedFrom: experience.clonedFrom,
              },
              {
                id: experience.id,
              },
            ],
          },
        ) as Promise<Count>;

        invocationCtx.args[0] = {
          userId: userId,
          experienceId: newExperience.id,
          clonedFrom: experience.clonedFrom,
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
        };

        break;
      }

      case MethodType.MODIFY: {
        const newExperience = invocationCtx.args[1];
        const experience = await this.experienceRepository.findById(invocationCtx.args[0]);
        const user = await this.userRepository.findById(newExperience.createdBy);

        if (experience.createdBy === user.id)
          throw new HttpErrors.UnprocessableEntity('Experience already belong to you!');

        newExperience.tags = setStatus(newExperience.tags, StatusType.NONE);
        newExperience.people = setStatus(newExperience.people, StatusType.NONE);
        newExperience.origin = true;
        newExperience.clonedFrom = null;
        newExperience.cloned = 0;
        newExperience.updatedAt = new Date().toString();

        invocationCtx.args[1] = newExperience;

        break;
      }

      case MethodType.CREATENEW: {
        const experience = invocationCtx.args[0];
        const user = await this.userExperienceRepository.count({userId: experience.createdBy});

        if (user.count >= 10)
          throw new HttpErrors.UnprocessableEntity('Experience must not exceed 10 experiences');
        else count = user.count;

        experience.tags = setStatus(experience.tags, StatusType.NONE);
        experience.people = setStatus(experience.people, StatusType.NONE);
        experience.createdAt = new Date().toString();
        experience.updatedAt = new Date().toString();

        invocationCtx.args[0] = experience;

        break;
      }
    }
    // Add pre-invocation logic here
    const result = await next();
    // Add post-invocation logic here
    switch (methodName) {
      case MethodType.CLONE: {
        if (count === 0) {
          await this.userRepository.updateById(result.userId, {onTimeline: result.experienceId});
        }

        break;
      }

      case MethodType.CREATENEW: {
        if (count === 0) {
          await this.userRepository.updateById(result.createdBy, {onTimeline: result.id});
        }

        break;
      }

      case MethodType.MODIFY: {
        this.userExperienceRepository.updateAll(
          {clonedFrom: null},
          {userId: invocationCtx.args[0], experienceId: invocationCtx.args[1]},
        ) as Promise<Count>;

        break;
      }

      case MethodType.UPDATEBYID: {
        this.experienceService.updateOtherExperience(
          invocationCtx.args[0],
          invocationCtx.args[1],
        ) as Promise<void>;
      }
    }

    return result;
  }
}
