import {
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  service,
  ValueOrPromise,
} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {
  ActivityLogType,
  MethodType,
  PlatformType,
  ReferenceType,
} from '../enums';
import {Experience, People, User} from '../models';
import {
  ExperienceRepository,
  ExperienceUserRepository,
  UserExperienceRepository,
  UserRepository,
} from '../repositories';
import {ActivityLogService, MetricService, TagService} from '../services';
import {formatTag} from '../utils/format-tag';
import {intersection} from 'lodash';
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
    @service(TagService)
    protected tagService: TagService,
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
    await this.beforeExperience(invocationCtx);

    const result = await next();

    return this.afterExperience(invocationCtx, result);
  }

  async beforeExperience(invocationCtx: InvocationContext): Promise<void> {
    let userId = invocationCtx.args[0];
    let experienceId = invocationCtx.args[1];

    const methodName = invocationCtx.methodName;
    const userExperienceId = invocationCtx.args[0];

    let numberOfUserExperience = 0;
    let people = [];
    let users = [];
    let isBelongToUser = false;

    switch (methodName) {
      case MethodType.CREATE: {
        const experience: Experience = invocationCtx.args[1];
        const tagExperience = experience.allowedTags.filter(e => e !== '');
        const prohibitedTags = experience.prohibitedTags;
        const intersectionTags = intersection(tagExperience, prohibitedTags);
        const expPeople = experience.people.filter(e => {
          if (
            e.id === '' ||
            e.name === '' ||
            e.username === '' ||
            !e.platform
          ) {
            return false;
          }

          const platforms = [
            PlatformType.MYRIAD,
            PlatformType.REDDIT,
            PlatformType.TWITTER,
          ];

          if (platforms.includes(e.platform)) return true;
          return false;
        });
        if (expPeople.length === 0) {
          throw new HttpErrors.UnprocessableEntity('People cannot be empty!');
        }
        if (tagExperience.length === 0) {
          throw new HttpErrors.UnprocessableEntity('Tags cannot be empty!');
        }
        if (intersectionTags.length > 0) {
          throw new HttpErrors.UnprocessableEntity(
            'You cannot insert same hashtag in allowed and prohibited tags',
          );
        }

        people = expPeople.filter(e => e.platform !== PlatformType.MYRIAD);
        users = expPeople.filter(e => e.platform === PlatformType.MYRIAD);

        numberOfUserExperience = await this.validateNumberOfUserExperience(
          userId,
        );
        invocationCtx.args[1] = Object.assign(experience, {
          createdBy: userId,
          people: people,
          allowedTags: tagExperience.map(tag => formatTag(tag)),
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

        numberOfUserExperience = await this.validateSubscribeExperience(
          userId,
          experienceId,
        );
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
        ({userId, experienceId} = await this.userExperienceRepository.findById(
          userExperienceId,
        ));
        break;
      }
    }

    invocationCtx.args[3] = {
      userId,
      experienceId,
      numberOfUserExperience,
      users,
      isBelongToUser,
    };
  }

  async afterExperience(
    invocationCtx: InvocationContext,
    result: AnyObject,
  ): Promise<AnyObject> {
    const methodName = invocationCtx.methodName;
    const {
      users,
      userId,
      experienceId,
      numberOfUserExperience,
      isBelongToUser,
    } = invocationCtx.args[3];

    if (
      (methodName === MethodType.CREATE ||
        methodName === MethodType.SUBSCRIBE) &&
      numberOfUserExperience === 0
    ) {
      await this.userRepository.updateById(userId, {
        onTimeline:
          methodName === MethodType.SUBSCRIBE ? result.experienceId : result.id,
      });
    }

    if (methodName === MethodType.SUBSCRIBE && !isBelongToUser) {
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
        methodName === MethodType.UPDATEEXPERIENCE) &&
      users.length > 0
    ) {
      Promise.allSettled(
        users.map(async (user: User) => {
          return this.experienceUserRepository.create({
            userId: user.id,
            experienceId:
              methodName === MethodType.UPDATEEXPERIENCE
                ? experienceId
                : result.id,
          });
        }),
      ) as Promise<AnyObject>;
    }

    if (methodName === MethodType.CREATE) {
      const createdExperience = result as Experience;
      const allowedTags = createdExperience.allowedTags;
      const prohibitedTags = createdExperience.prohibitedTags;
      const tags = [...allowedTags, ...prohibitedTags];
      const clonedId = invocationCtx.args[2];

      if (clonedId) {
        await this.userExperienceRepository.updateAll(
          {clonedId},
          {userId, experienceId: result.id.toString()},
        );
        const {count: totalCloned} = await this.userExperienceRepository.count({
          clonedId,
        });
        await this.experienceRepository.updateById(clonedId, {
          clonedCount: totalCloned,
        });
      }

      await this.tagService.createTags(tags, true);
      await this.activityLogService.createLog(
        ActivityLogType.CREATEEXPERIENCE,
        result.id,
        ReferenceType.EXPERIENCE,
      );
    }

    if (methodName === MethodType.SUBSCRIBE) {
      if (isBelongToUser) {
        await this.userExperienceRepository.updateById(result.id, {
          subscribed: false,
        });

        result = Object.assign(result, {subscribed: false});
      } else {
        await this.activityLogService.createLog(
          ActivityLogType.SUBSCRIBEEXPERIENCE,
          result.experienceId,
          ReferenceType.EXPERIENCE,
        );
      }
    }

    if (methodName === MethodType.DELETEBYID) {
      const {count: countExperience} =
        await this.userExperienceRepository.count({
          or: [
            {
              experienceId,
              subscribed: true,
            },
            {
              experienceId,
              subscribed: false,
            },
          ],
        });

      if (countExperience === 0) {
        await this.experienceRepository.deleteById(experienceId);
      } else {
        await this.experienceRepository.updateById(experienceId, {
          subscribedCount: countExperience,
        });
      }

      const {count: countUserExperience} =
        await this.userExperienceRepository.count({userId});

      if (countUserExperience === 0) {
        await this.userRepository.updateById(userId, {onTimeline: undefined});
      } else {
        try {
          const user = await this.userRepository.findById(userId);

          if (experienceId === user.onTimeline?.toString()) {
            const userExperience = await this.userExperienceRepository.findOne({
              where: {userId},
            });

            if (userExperience) {
              await this.userRepository.updateById(userId, {
                onTimeline: userExperience.experienceId,
              });
            }
          }
        } catch {
          // ignore
        }
      }
    }

    // Recounting userMetric after create, clone, and subscribe
    await this.metricService.userMetric(userId);

    return result;
  }

  async validateSubscribeExperience(
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
