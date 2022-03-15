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
import {injectable, BindingScope, service} from '@loopback/core';
import {FriendService} from './friend.service';
import {omit} from 'lodash';

@injectable({scope: BindingScope.TRANSIENT})
export class ExperienceService {
  constructor(
    @repository(UserExperienceRepository)
    public userExperienceRepository: UserExperienceRepository,
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
    @repository(ExperiencePostRepository)
    protected experiencePostRepository: ExperiencePostRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @service(FriendService)
    protected friendService: FriendService,
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
    const experience = await this.getExperience(userId, experienceId);

    if (!experience) return;

    const postIds = await this.getExperiencePostId(experience.id ?? '');
    const userIds: string[] = [];
    const allowedTags = experience.allowedTags;
    const prohibitedTags = experience.prohibitedTags;
    const personIds = experience.people
      .filter((e: People) => e.platform !== PlatformType.MYRIAD)
      .map(e => e.id);
    const blockedFriendIds = await this.friendService.getFriendIds(
      userId,
      FriendStatusType.BLOCKED,
    );
    const approvedFriendIds = await this.friendService.getFriendIds(
      userId,
      FriendStatusType.APPROVED,
    );
    const friends = await this.friendService.friendRepository.find({
      where: {
        requestorId: userId,
        requesteeId: {inq: (experience.users ?? []).map(e => e.id)},
        status: FriendStatusType.APPROVED,
      },
    });
    const friendIds = friends.map(friend => friend.requesteeId);
    const blockedUserIds = blockedFriendIds.filter(
      id => ![...friendIds, ...approvedFriendIds].includes(id),
    );

    if (experience?.users) {
      for (const user of experience.users) {
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
            {createdBy: {nin: blockedUserIds}},
            {visibility: VisibilityType.PUBLIC},
          ],
        },
        {
          and: [
            {peopleId: {inq: personIds}},
            {createdBy: {nin: blockedUserIds}},
            {visibility: VisibilityType.PUBLIC},
          ],
        },
        {
          and: [
            {id: {inq: postIds}},
            {createdBy: {nin: blockedUserIds}},
            {visibility: VisibilityType.PUBLIC},
          ],
        },
        {
          and: [
            {id: {inq: postIds}},
            {createdBy: {inq: friendIds}},
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
            {visibility: VisibilityType.PUBLIC},
          ],
        },
        {
          and: [
            {createdBy: {inq: friendIds}},
            {visibility: VisibilityType.FRIEND},
          ],
        },
        {
          and: [{peopleId: {inq: personIds}}, {createdBy: userId}],
        },
      ],
      experienceId: experience.id,
    } as Where<Post>;
  }

  async privateUserExperience(
    userId: string,
    userExperiences: UserExperienceWithRelations[],
  ): Promise<AnyObject[]> {
    return Promise.all(
      userExperiences.map(async userExperience => {
        const accountSetting = userExperience.experience?.user?.accountSetting;
        const privateUserExperience = {
          ...userExperience,
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

        if (friend) privateUserExperience.friend = true;
        if (
          accountSetting?.accountPrivacy === AccountSettingType.PRIVATE &&
          accountSetting?.userId !== userId &&
          friend === null
        ) {
          privateUserExperience.private = true;
        }

        return privateUserExperience;
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

  async getExperiencePostId(experienceId: string): Promise<string[]> {
    const experiencePosts = await this.experiencePostRepository.find({
      where: {experienceId},
    });
    return experiencePosts.map(e => e.postId?.toString());
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
