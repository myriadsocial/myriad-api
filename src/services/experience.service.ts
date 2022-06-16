import {AnyObject, repository, Where} from '@loopback/repository';
import {
  AccountSettingType,
  FriendStatusType,
  PlatformType,
  VisibilityType,
} from '../enums';
import {
  Experience,
  ExperienceWithRelations,
  People,
  Post,
  UserExperienceWithRelations,
} from '../models';
import {
  ExperiencePostRepository,
  ExperienceRepository,
  UserExperienceRepository,
  UserRepository,
} from '../repositories';
import {injectable, BindingScope, service, inject} from '@loopback/core';
import {FriendService} from './friend.service';
import {omit} from 'lodash';
import {HttpErrors} from '@loopback/rest';
import {AuthenticationBindings} from '@loopback/authentication';
import {UserProfile, securityId} from '@loopback/security';
import {pull} from 'lodash';

@injectable({scope: BindingScope.TRANSIENT})
export class ExperienceService {
  constructor(
    @repository(ExperienceRepository)
    public experienceRepository: ExperienceRepository,
    @repository(ExperiencePostRepository)
    public experiencePostRepository: ExperiencePostRepository,
    @repository(UserExperienceRepository)
    public userExperienceRepository: UserExperienceRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @service(FriendService)
    protected friendService: FriendService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    protected currentUser: UserProfile,
  ) {}

  async getExperience(
    userId: string,
    experienceId?: string,
  ): Promise<Experience | null> {
    let experience = null;

    try {
      if (experienceId) {
        experience = await this.experienceRepository.findById(experienceId, {
          include: [
            {
              relation: 'users',
              scope: {
                include: [{relation: 'accountSetting'}],
              },
            },
          ],
        });
      } else {
        const user = await this.userRepository.findById(userId, {
          include: [
            {
              relation: 'experience',
              scope: {
                include: [
                  {
                    relation: 'users',
                    scope: {
                      include: [{relation: 'accountSetting'}],
                    },
                  },
                ],
              },
            },
          ],
        });

        if (user.experience) experience = user.experience;
      }
    } catch {
      // ignore
    }

    return experience;
  }

  async experienceTimeline(
    userId: string,
    experienceId?: string,
  ): Promise<Where<Post> | undefined> {
    const exp = await this.getExperience(userId, experienceId);

    if (!exp) return;

    const postIds = await this.getExperiencePostId(exp.id ?? '');
    const userIds: string[] = [];
    const allowedTags = exp.allowedTags.map(tag => tag.toLowerCase());
    const prohibitedTags = exp.prohibitedTags.map(tag => tag.toLowerCase());
    const personIds = exp.people
      .filter((e: People) => e.platform !== PlatformType.MYRIAD)
      .map(e => e.id);
    const [blockedFriendIds, approvedFriendIds, friends] = await Promise.all([
      this.friendService.getFriendIds(userId, FriendStatusType.BLOCKED),
      this.friendService.getFriendIds(userId, FriendStatusType.APPROVED),
      this.friendService.friendRepository.find({
        where: {
          requestorId: userId,
          requesteeId: {inq: (exp.users ?? []).map(e => e.id)},
          status: FriendStatusType.APPROVED,
        },
      }),
    ]);
    const friendIds = friends.map(friend => friend.requesteeId);
    const blocked = pull(blockedFriendIds, ...friendIds, ...approvedFriendIds);

    if (exp?.users) {
      for (const user of exp.users) {
        const accountPrivacy = user?.accountSetting.accountPrivacy;
        const privateSetting = AccountSettingType.PRIVATE;

        if (accountPrivacy === privateSetting) {
          const found = friendIds.find(id => id === user.id);
          if (found) userIds.push(user.id);
        } else {
          userIds.push(user.id);
        }
      }
    }

    return {
      or: [
        {
          and: [
            {tags: {inq: allowedTags}},
            {tags: {nin: prohibitedTags}},
            {createdBy: {nin: blocked}},
            {visibility: VisibilityType.PUBLIC},
          ],
        },
        {
          and: [
            {peopleId: {inq: personIds}},
            {tags: {nin: prohibitedTags}},
            {createdBy: {nin: blocked}},
            {visibility: VisibilityType.PUBLIC},
          ],
        },
        {
          and: [
            {id: {inq: postIds}},
            {createdBy: {nin: blocked}},
            {tags: {nin: prohibitedTags}},
            {visibility: VisibilityType.PUBLIC},
          ],
        },
        {
          and: [
            {id: {inq: postIds}},
            {createdBy: {inq: friendIds}},
            {tags: {nin: prohibitedTags}},
            {visibility: VisibilityType.FRIEND},
          ],
        },
        {
          and: [
            {tags: {inq: allowedTags}},
            {tags: {nin: prohibitedTags}},
            {createdBy: userId},
          ],
        },
        {
          and: [
            {createdBy: {inq: userIds}},
            {tags: {nin: prohibitedTags}},
            {visibility: VisibilityType.PUBLIC},
          ],
        },
        {
          and: [
            {createdBy: {inq: friendIds}},
            {tags: {nin: prohibitedTags}},
            {visibility: VisibilityType.FRIEND},
          ],
        },
        {
          and: [
            {peopleId: {inq: personIds}},
            {tags: {nin: prohibitedTags}},
            {createdBy: userId},
          ],
        },
      ],
      experienceId: exp.id,
    } as Where<Post>;
  }

  async privateUserExperience(
    userId: string,
    userExperiences: UserExperienceWithRelations[],
  ): Promise<AnyObject[]> {
    return Promise.all(
      userExperiences.map(async userExperience => {
        const accountSetting = userExperience.experience?.user?.accountSetting;
        const privateUserExp: AnyObject = {
          ...userExperience,
          private: false,
          friend: false,
          blocked: false,
        };

        const friend = await this.friendService.friendRepository.findOne({
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
              $exists: false,
            },
          },
        });

        const status = friend?.status;
        if (status === FriendStatusType.APPROVED) privateUserExp.friend = true;
        if (status === FriendStatusType.BLOCKED) privateUserExp.blocked = true;
        if (
          accountSetting?.accountPrivacy === AccountSettingType.PRIVATE &&
          accountSetting?.userId !== userId &&
          friend === null
        ) {
          privateUserExp.private = true;
        }

        return omit(privateUserExp, ['clonedId']);
      }),
    );
  }

  async privateExperience(
    userId: string,
    experience: ExperienceWithRelations,
  ): Promise<AnyObject> {
    const accountSetting = experience?.user?.accountSetting;
    const privateExperience = {
      ...experience,
      private: false,
      friend: false,
    };

    const friend = await this.friendService.friendRepository.findOne({
      where: <AnyObject>{
        requestorId: userId,
        requesteeId: accountSetting?.userId ?? '',
        status: FriendStatusType.APPROVED,
        deletedAt: {
          $exists: false,
        },
      },
    });

    if (friend) privateExperience.friend = true;
    if (
      accountSetting?.accountPrivacy === AccountSettingType.PRIVATE &&
      accountSetting?.userId !== userId &&
      friend === null
    ) {
      privateExperience.private = true;
    }

    return privateExperience;
  }

  async getExperiencePostId(experienceId?: string): Promise<string[]> {
    if (!experienceId) return [];

    const experiencePosts = await this.experiencePostRepository.find({
      where: {experienceId},
    });
    return experiencePosts.map(e => e.postId?.toString());
  }

  async removeExperiencePost(
    postId: string,
    otherExperienceIds?: string[],
  ): Promise<string[]> {
    if (otherExperienceIds) {
      await this.experiencePostRepository.deleteAll({
        experienceId: {inq: otherExperienceIds},
        postId: postId,
      });

      return otherExperienceIds;
    }

    if (!this.currentUser?.[securityId]) return [];
    const experiences = await this.experienceRepository.find({
      where: {
        createdBy: this.currentUser[securityId],
      },
    });
    const experienceIds = experiences.map(experience => experience?.id ?? '');
    if (experienceIds.length === 0) return [];
    await this.experiencePostRepository.deleteAll({
      experienceId: {inq: experienceIds},
      postId: postId,
    });
    return experienceIds;
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

  async validatePrivateExperience(experience: ExperienceWithRelations) {
    if (!experience?.user?.accountSetting) return;
    if (experience.createdBy === this.currentUser[securityId]) return;
    const {accountPrivacy} = experience.user.accountSetting;
    const friend = await this.friendService.friendRepository.findOne({
      where: {
        or: [
          {
            requestorId: this.currentUser[securityId],
            requesteeId: experience.createdBy,
          },
          {
            requesteeId: this.currentUser[securityId],
            requestorId: experience.createdBy,
          },
        ],
      },
    });
    const isPublic = accountPrivacy === AccountSettingType.PUBLIC;
    const isNotBlocked = friend?.status !== FriendStatusType.BLOCKED;
    const isValid = isPublic && isNotBlocked;
    if (friend?.status === FriendStatusType.APPROVED) return;
    if (isValid) return;
    throw new HttpErrors.Forbidden('PrivateExperience');
  }

  combinePeopleAndUser(
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
}
