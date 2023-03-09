import {BindingScope, injectable, service} from '@loopback/core';
import {
  AnyObject,
  Count,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {intersection, omit} from 'lodash';
import {
  AccountSettingType,
  ActivityLogType,
  FriendStatusType,
  PlatformType,
  ReferenceType,
  VisibilityType,
} from '../enums';
import {
  Experience,
  People,
  UserExperience,
  UserExperienceWithRelations,
} from '../models';
import {
  ExperienceRepository,
  ExperienceUserRepository,
  UserExperienceRepository,
  UserRepository,
} from '../repositories';
import {formatTag} from '../utils/formatter';
import {ActivityLogService} from './activity-log.service';
import {FriendService} from './friend.service';
import {MetricService} from './metric.service';
import {TagService} from './tag.service';

@injectable({scope: BindingScope.TRANSIENT})
export class UserExperienceService {
  constructor(
    @repository(ExperienceRepository)
    private experienceRepository: ExperienceRepository,
    @repository(ExperienceUserRepository)
    private experienceUserRepository: ExperienceUserRepository,
    @repository(UserExperienceRepository)
    private userExperienceRepository: UserExperienceRepository,
    @repository(UserRepository)
    private userRepository: UserRepository,
    @service(ActivityLogService)
    private activityLogService: ActivityLogService,
    @service(FriendService)
    private friendService: FriendService,
    @service(MetricService)
    private metricService: MetricService,
    @service(TagService)
    private tagService: TagService,
  ) {}

  // ------------------------------------------------

  // ------ UserExperience --------------------------

  public async findById(
    id: string,
    filter?: Filter<UserExperience>,
    userId?: string,
  ): Promise<UserExperienceWithRelations> {
    return this.userExperienceRepository
      .findById(id, filter)
      .then(async userExperience => {
        if (userId) {
          const data = this.combinePeopleAndUser([userExperience]);
          const [privateUserExperience] = await this.privateUserExperience(
            userId,
            data,
          );

          return privateUserExperience;
        }

        return userExperience;
      });
  }

  public async find(
    filter?: Filter<UserExperience>,
    userId?: string,
  ): Promise<UserExperienceWithRelations[]> {
    return this.userExperienceRepository
      .find(filter)
      .then(async userExperiences => {
        const includeUser = Object.prototype.hasOwnProperty.call(
          filter?.where ?? {},
          'userId',
        );

        if (userId && includeUser) {
          const data = this.combinePeopleAndUser(userExperiences);
          const privateUserExperience = await this.privateUserExperience(
            userId,
            data,
          );

          return privateUserExperience.filter(userExperience => {
            if (userExperience.private) {
              if (userExperience.friend) return true;
              return false;
            }

            if (!userExperience.blocked) return true;
            return false;
          });
        }

        return userExperiences;
      });
  }

  public async findOne(
    filter?: Filter<UserExperience>,
  ): Promise<UserExperienceWithRelations | null> {
    return this.userExperienceRepository.findOne(filter);
  }

  public async update(
    id: string,
    experience: Partial<Experience>,
  ): Promise<Count> {
    const userId = experience.createdBy;

    if (!userId) return {count: 0};

    const people = this.validateExperienceData(experience as Experience);

    await Promise.all([
      this.validateUpdateExperience(userId, id),
      this.experienceUserRepository.deleteAll({experienceId: id}),
    ]);

    const visibility = experience.visibility;
    if (visibility && visibility !== VisibilityType.SELECTED) {
      experience.selectedUserIds = [];
    }

    return this.userRepository
      .experiences(userId)
      .patch(experience, {id})
      .then(async ({count}) => {
        const jobs = [];

        if (count > 0) {
          jobs.push(
            this.metricService.userMetric(userId),
            ...people.map(({id: peopleId, platform}) => {
              if (platform !== PlatformType.MYRIAD) return;
              return this.experienceUserRepository.create({
                userId: peopleId,
                experienceId: id,
              });
            }),
          );
        }

        if (visibility && visibility !== VisibilityType.PUBLIC) {
          const where: Where<UserExperience> = {
            experienceId: id,
            subscribed: true,
          };

          if (visibility === VisibilityType.SELECTED) {
            const selectedUserIds = experience?.selectedUserIds ?? [];
            const userIds = selectedUserIds.map(e => e.userId);
            where.userId = {nin: userIds};
          }

          if (visibility === VisibilityType.FRIEND) {
            const friends = await this.friendService.getFriendIds(
              userId,
              FriendStatusType.APPROVED,
            );
            where.userId = {nin: friends};
          }

          jobs.push(this.userExperienceRepository.deleteAll(where));
        }

        Promise.all(jobs) as Promise<AnyObject>;

        return {count};
      });
  }

  public async count(where: Where<UserExperience>): Promise<Count> {
    return this.userExperienceRepository.count(where);
  }

  public async create(
    experience: Omit<Experience, 'id'>,
    clonedId?: string,
  ): Promise<Experience> {
    const userId = experience.createdBy;
    const people = this.validateExperienceData(experience);
    const totalExperience = await this.countUserExperience(userId);

    if (experience.visibility !== VisibilityType.SELECTED) {
      experience.selectedUserIds = [];
    }

    return this.userRepository
      .experiences(userId)
      .create(experience)
      .then(async created =>
        this.afterCreate(created, people, totalExperience, clonedId),
      );
  }

  public async subscribe(
    experienceId: string,
    userId: string,
  ): Promise<UserExperience> {
    const subscribed = await this.beforeSubscribe(userId, experienceId);

    return this.userExperienceRepository
      .create({userId, experienceId, subscribed})
      .then(created => this.afterSubscribe(created));
  }

  public async unsubscribe(id: string, userId: string): Promise<void> {
    const {experienceId, experience} = await this.findById(id, {
      where: {userId},
      include: ['experience'],
    });

    const experienceCreator = experience?.createdBy ?? '';

    return this.userExperienceRepository.deleteById(id).then(() => {
      // Update experience subscribed count
      // Removing experience when subscribed count zero
      const promises: Promise<void | AnyObject>[] = [];

      if (experienceCreator === userId) {
        promises.push(
          this.userExperienceRepository.deleteAll({experienceId}),
          this.experienceRepository.deleteById(experienceId),
        );
      }

      promises.push(
        this.userRepository
          .findOne({where: {onTimeline: experienceId}})
          .then(user => {
            if (!user) return [];
            return this.userExperienceRepository.find({
              where: {userId},
              limit: 1,
              order: ['createdAt DESC'],
            });
          })
          .then(([latest]) =>
            this.userRepository.updateById(userId, {
              onTimeline: latest?.experienceId,
            }),
          ),
      );

      Promise.allSettled(promises) as Promise<AnyObject>;
    });
  }

  // ------------------------------------------------

  // ------ PrivateMethod ---------------------------

  private async afterCreate(
    experience: Experience,
    people: People[],
    totalExperience: number,
    clonedId?: string,
  ): Promise<Experience> {
    const userId = experience.createdBy;
    const experienceId = experience?.id ?? '';
    const tags = [...experience.allowedTags, ...experience.prohibitedTags];
    const promises: Promise<AnyObject | void>[] = [
      this.tagService.create(tags, true),
      this.activityLogService.create(
        ActivityLogType.CREATEEXPERIENCE,
        experienceId,
        ReferenceType.EXPERIENCE,
      ),
      this.metricService.userMetric(userId),
      this.metricService.countServerMetric(),
      ...people.map(({id, platform}) => {
        if (platform !== PlatformType.MYRIAD) return Promise.resolve();
        return this.experienceUserRepository.create({
          userId: id,
          experienceId,
        });
      }),
    ];

    if (clonedId) {
      promises.push(
        this.userExperienceRepository
          .updateAll({clonedId}, {userId, experienceId})
          .then(() =>
            Promise.all([
              this.count({clonedId}),
              this.count({
                experienceId: clonedId,
                subscribed: true,
              }),
            ]),
          )
          .then(([{count: clonedCount}, {count: subscribedCount}]) => {
            const trendCount = clonedCount + subscribedCount;
            return this.experienceRepository.updateById(clonedId, {
              clonedCount,
              trendCount,
            });
          }),
      );
    }

    if (!totalExperience) {
      promises.push(
        this.userRepository.updateById(userId, {
          onTimeline: experienceId,
        }),
      );
    }

    Promise.allSettled(promises) as Promise<AnyObject>;

    return experience;
  }

  private async beforeSubscribe(
    userId: string,
    experienceId: string,
  ): Promise<boolean> {
    const userExperience = await this.findOne({
      where: {userId, experienceId},
      include: ['experience'],
    });

    if (userExperience?.subscribed) {
      throw new HttpErrors.UnprocessableEntity('ExperienceAlreadySubscribed');
    }

    const experienceCreator = userExperience?.experience?.createdBy;
    const visibility = userExperience?.experience?.visibility;

    if (experienceCreator && experienceCreator !== userId) {
      switch (visibility) {
        case VisibilityType.FRIEND: {
          const asFriend = await this.friendService.asFriend(
            experienceCreator,
            userId,
          );
          if (asFriend) break;
          throw new HttpErrors.UnprocessableEntity('OnlyFriendCanSubscribe');
        }

        case VisibilityType.SELECTED: {
          const experience = userExperience?.experience;
          const selectedUser = experience?.selectedUserIds ?? [];
          const selected = selectedUser.find(e => {
            if (typeof e === 'string') return e === userId;
            return e.userId === userId;
          });
          if (selected) break;
          throw new HttpErrors.UnprocessableEntity(
            'OnlySelectedUserCanSubscribe',
          );
        }

        case VisibilityType.PRIVATE:
          throw new HttpErrors.UnprocessableEntity('PrivateExperience');
      }
    }

    if (userExperience && userId === experienceCreator) {
      throw new HttpErrors.UnprocessableEntity('ExperienceAlreadyExist');
    }

    if (userId === experienceCreator) return false;
    return true;
  }

  private async afterSubscribe(
    userExperience: UserExperience,
  ): Promise<UserExperience> {
    const {userId, experienceId} = userExperience;
    const promises: Promise<AnyObject | void>[] = [
      Promise.all([
        this.count({experienceId, subscribed: true}),
        this.count({clonedId: experienceId}),
      ]).then(([{count: subscribedCount}, {count: clonedCount}]) => {
        const trendCount = subscribedCount + clonedCount;
        return this.experienceRepository.updateById(experienceId, {
          subscribedCount,
          trendCount,
        });
      }),
      this.count({userId}).then(({count}) => {
        if (count > 0) return;
        return this.userRepository.updateById(userId, {
          onTimeline: experienceId,
        });
      }),
      this.activityLogService.create(
        ActivityLogType.SUBSCRIBEEXPERIENCE,
        experienceId,
        ReferenceType.EXPERIENCE,
      ),
      this.metricService.userMetric(userId),
      this.metricService.countServerMetric(),
    ];

    Promise.allSettled(promises) as Promise<AnyObject>;

    return userExperience;
  }

  private async privateUserExperience(
    userId: string,
    userExperiences: UserExperienceWithRelations[],
  ): Promise<UserExperienceWithRelations[]> {
    return Promise.all(
      userExperiences.map(async userExperience => {
        const accountSetting = userExperience.experience?.user?.accountSetting;

        userExperience.private = false;
        userExperience.friend = false;
        userExperience.blocked = false;

        const friend = await this.friendService.findOne({
          where: <AnyObject>{
            or: [
              {
                requestorId: userId,
                requesteeId: accountSetting?.userId ?? '',
              },
              {
                requesteeId: userId,
                requestorId: accountSetting?.userId ?? '',
              },
            ],
            deletedAt: {
              $eq: null,
            },
          },
        });

        const status = friend?.status;
        if (status === FriendStatusType.APPROVED) userExperience.friend = true;
        if (status === FriendStatusType.BLOCKED) userExperience.blocked = true;
        if (
          accountSetting?.accountPrivacy === AccountSettingType.PRIVATE &&
          accountSetting?.userId !== userId &&
          friend === null
        ) {
          userExperience.private = true;
        }

        return userExperience;
      }),
    );
  }

  private async countUserExperience(userId: string): Promise<number> {
    const {count: total} = await this.userExperienceRepository.count({userId});
    return total;
  }

  private async validateUpdateExperience(
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

    if (!userExperience) {
      throw new HttpErrors.UnprocessableEntity('ExperienceNotFound');
    }

    const {subscribed, experience} = userExperience;

    if (subscribed) throw new HttpErrors.Unauthorized('UnauthorizedUser');
    if (experience && experience?.createdBy !== userId) {
      throw new HttpErrors.Unauthorized('UnauthorizedUser');
    }
  }

  private validateExperienceData(experience: Omit<Experience, 'id'>): People[] {
    const userId = experience.createdBy;
    const allowedTags = experience?.allowedTags?.filter(e => e !== '') ?? [];
    const prohibitedTags = experience?.prohibitedTags ?? [];
    const intersectionTags = intersection(allowedTags, prohibitedTags);
    const people =
      experience?.people?.filter(e => {
        if (e.id === '' || e.name === '' || e.username === '' || !e.platform) {
          return false;
        }

        const platforms = [
          PlatformType.MYRIAD,
          PlatformType.REDDIT,
          PlatformType.TWITTER,
        ];

        if (platforms.includes(e.platform)) return true;
        return false;
      }) ?? [];

    if (intersectionTags.length > 0) {
      throw new HttpErrors.UnprocessableEntity(
        'IntersectBetweenAllowedAndProhibitedTag',
      );
    }

    if (experience.visibility === VisibilityType.SELECTED) {
      if (experience?.selectedUserIds.length === 0) {
        throw new HttpErrors.UnprocessableEntity('AtLeastSelectOneUser');
      }
    }

    Object.assign(experience, {
      createdBy: userId,
      people: people.filter(e => e.platform !== PlatformType.MYRIAD),
      allowedTags: allowedTags.map(tag => formatTag(tag)),
    });

    return people;
  }

  private combinePeopleAndUser(
    result: UserExperienceWithRelations[],
  ): UserExperienceWithRelations[] {
    return result.map((userExperience: UserExperienceWithRelations) => {
      const users = userExperience.experience?.users;

      if (!users) return userExperience;

      const newExperience: Partial<Experience> = {
        ...userExperience.experience,
      };

      const userToPeople = users.map(user => {
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

      const people = userExperience.experience?.people ?? [];

      newExperience.people = [...userToPeople, ...people];
      userExperience.experience = newExperience as Experience;

      return omit(userExperience, ['users']) as UserExperienceWithRelations;
    });
  }

  // ------------------------------------------------
}
