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
    const [userId, experienceId] = invocationCtx.args;
    const methodName = invocationCtx.methodName;
    const data = {
      totalUserExp: 0,
      users: [] as People[],
      isBelongToUser: false,
      userId,
      experienceId,
      experienceCreator: '',
    };

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

        const people = expPeople.filter(
          e => e.platform !== PlatformType.MYRIAD,
        );
        data.users = expPeople.filter(e => e.platform === PlatformType.MYRIAD);
        data.totalUserExp = await this.validateNumberOfUserExperience(userId);

        Object.assign(invocationCtx.args[1], {
          createdBy: userId,
          people: people,
          allowedTags: tagExperience.map(tag => formatTag(tag)),
        });
        break;
      }

      case MethodType.SUBSCRIBE: {
        const userExperience = await this.userExperienceRepository.findOne({
          where: {userId, experienceId},
          include: ['experience'],
        });

        const experienceCreator = userExperience?.experience?.createdBy;
        if (userExperience && userId === experienceCreator) {
          throw new HttpErrors.UnprocessableEntity(
            'You already belong this experience!',
          );
        }

        if (userId === experienceCreator) data.isBelongToUser = true;

        data.totalUserExp = await this.validateSubscribeExperience(
          userId,
          experienceId,
        );
        break;
      }

      case MethodType.UPDATEEXPERIENCE: {
        const rawPeople = invocationCtx.args[2].people as People[];
        if (rawPeople.length === 0) {
          throw new HttpErrors.UnprocessableEntity('People cannot be empty!');
        }

        await this.validateUpdateExperience(userId, experienceId);
        await this.experienceUserRepository.deleteAll({experienceId});

        const people = rawPeople.filter(
          e => e.platform !== PlatformType.MYRIAD,
        );
        data.users = rawPeople.filter(e => e.platform === PlatformType.MYRIAD);

        Object.assign(invocationCtx.args[2], {people});
        break;
      }

      case MethodType.DELETEBYID: {
        const id = invocationCtx.args[0];
        const userExp = await this.userExperienceRepository.findById(id, {
          include: ['experience'],
        });
        data.userId = userExp.userId;
        data.experienceId = userExp.experienceId;
        data.experienceCreator = userExp.experience?.createdBy ?? '';
        break;
      }
    }

    invocationCtx.args[3] = data;
  }

  async afterExperience(
    invocationCtx: InvocationContext,
    result: AnyObject,
  ): Promise<AnyObject> {
    const {
      users,
      userId,
      experienceId,
      totalUserExp,
      isBelongToUser,
      experienceCreator,
    } = invocationCtx.args[3];

    const methodName = invocationCtx.methodName;
    const expRepos = this.experienceRepository;
    const expUserRepos = this.experienceUserRepository;
    const userExpRepos = this.userExperienceRepository;
    const userRepos = this.userRepository;
    const promises: Promise<AnyObject | void>[] = [
      this.metricService.userMetric(userId),
    ];

    switch (methodName) {
      case MethodType.CREATE: {
        const createdExperience = result as Experience;
        const allowedTags = createdExperience.allowedTags;
        const prohibitedTags = createdExperience.prohibitedTags;
        const tags = [...allowedTags, ...prohibitedTags];
        const clonedId = invocationCtx.args[2];
        const expId = result.id.toString();

        if (clonedId) {
          const {count: clonedCount} = await userExpRepos.count({
            clonedId,
          });
          promises.push(
            expRepos.updateById(clonedId, {clonedCount}),
            userExpRepos.updateAll({clonedId}, {userId, experienceId: expId}),
          );
        }

        if (totalUserExp === 0) {
          promises.push(userRepos.updateById(userId, {onTimeline: expId}));
        }

        if (users.length > 0) {
          users.forEach((user: User) => {
            promises.push(
              expUserRepos.create({userId: user.id, experienceId: expId}),
            );
          });
        }

        promises.push(
          this.tagService.createTags(tags, true),
          this.activityLogService.createLog(
            ActivityLogType.CREATEEXPERIENCE,
            result.id,
            ReferenceType.EXPERIENCE,
          ),
        );

        break;
      }

      case MethodType.SUBSCRIBE: {
        if (totalUserExp === 0) {
          const onTimeline = result.experienceId;
          promises.push(userRepos.updateById(userId, {onTimeline}));
        }

        const subscribed = !isBelongToUser;
        if (isBelongToUser) {
          promises.push(userExpRepos.updateById(result.id, {subscribed}));
          Object.assign(result, {subscribed});
        } else {
          const {count: subscribedCount} = await userExpRepos.count({
            experienceId,
            subscribed,
          });

          promises.push(
            expRepos.updateById(experienceId, {subscribedCount}),
            this.activityLogService.createLog(
              ActivityLogType.SUBSCRIBEEXPERIENCE,
              result.experienceId,
              ReferenceType.EXPERIENCE,
            ),
          );
        }
        break;
      }

      case MethodType.DELETEBYID: {
        // Update experience subscribed count
        // Removing experience when subscribed count zero
        const {count: subscribedCount} = await userExpRepos.count({
          experienceId,
          subscribed: true,
        });

        if (subscribedCount === 0 && userId === experienceCreator) {
          promises.push(expRepos.deleteById(experienceId));
        } else {
          promises.push(expRepos.updateById(experienceId, {subscribedCount}));
        }

        // Update onTimeline for user
        const {count: countUserExperience} = await userExpRepos.count({userId});

        if (countUserExperience === 0) {
          promises.push(userRepos.updateById(userId, {onTimeline: undefined}));
        } else {
          const user = await userRepos.findOne({where: {id: userId}});

          if (experienceId === user?.onTimeline?.toString()) {
            const userExperience = await userExpRepos.findOne({
              where: {userId},
            });

            if (userExperience) {
              const onTimeline = userExperience.experienceId;
              promises.push(userRepos.updateById(userId, {onTimeline}));
            }
          }
        }
        break;
      }

      case MethodType.UPDATEEXPERIENCE: {
        if (users.length > 0) {
          users.forEach((user: User) => {
            promises.push(expUserRepos.create({userId: user.id, experienceId}));
          });
        }
        break;
      }
    }

    Promise.allSettled(promises) as AnyObject;

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
