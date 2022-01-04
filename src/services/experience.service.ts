import {repository, Where} from '@loopback/repository';
import {FriendStatusType, PlatformType, VisibilityType} from '../enums';
import {Experience, People, Post, UserExperienceWithRelations} from '../models';
import {
  ExperienceRepository,
  UserExperienceRepository,
  UserRepository,
} from '../repositories';
import {injectable, BindingScope, service} from '@loopback/core';
import {FriendService} from './friend.service';

@injectable({scope: BindingScope.TRANSIENT})
export class ExperienceService {
  constructor(
    @repository(UserExperienceRepository)
    protected userExperienceRepository: UserExperienceRepository,
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @service(FriendService)
    protected friendService: FriendService,
  ) {}

  async getExperience(userId: string): Promise<Experience | null> {
    let experience = null;

    try {
      const user = await this.userRepository.findById(userId, {
        include: [
          {
            relation: 'experience',
            scope: {
              include: [
                {
                  relation: 'users',
                },
              ],
            },
          },
        ],
      });

      if (user.experience) experience = user.experience;
    } catch {
      // ignore
    }

    return experience;
  }

  async experienceTimeline(
    userId: string,
    experienceId?: string,
  ): Promise<Where<Post> | undefined> {
    let experience: Experience | null = null;

    if (experienceId) {
      const {count} = await this.userExperienceRepository.count({
        userId,
        experienceId,
      });

      if (count === 0) return;

      experience = await this.experienceRepository.findById(experienceId, {
        include: ['users'],
      });
    } else {
      experience = await this.getExperience(userId);
    }

    if (!experience) return;

    const tags = experience.tags;
    const personIds = experience.people
      .filter((e: People) => e.platform !== PlatformType.MYRIAD)
      .map(e => e.id);
    const userIds = (experience.users ?? []).map(e => e.id);
    const blockedFriendIds = await this.friendService.getFriendIds(
      userId,
      FriendStatusType.BLOCKED,
    );
    const friends = await this.friendService.friendRepository.find({
      where: {
        requestorId: userId,
        requesteeId: {inq: userIds},
        status: FriendStatusType.APPROVED,
      },
    });
    const friendIds = friends.map(friend => friend.requesteeId);

    return {
      or: [
        {
          and: [
            {tags: {inq: tags}},
            {createdBy: {nin: blockedFriendIds}},
            {visibility: VisibilityType.PUBLIC},
          ],
        },
        {
          and: [
            {peopleId: {inq: personIds}},
            {createdBy: {nin: blockedFriendIds}},
            {visibility: VisibilityType.PUBLIC},
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
          and: [{tags: {inq: tags}}, {createdBy: userId}],
        },
        {
          and: [{peopleId: {inq: personIds}}, {createdBy: userId}],
        },
      ],
    } as Where<Post>;
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

      delete newExperience.users;

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
        });
      });

      const people = userExperience.experience?.people ?? [];

      newExperience.people = [...userToPeople, ...people];
      userExperience.experience = newExperience as Experience;

      return userExperience;
    });
  }
}
