import {repository, Where} from '@loopback/repository';
import {FriendStatusType, PlatformType, VisibilityType} from '../enums';
import {Experience, People, Post} from '../models';
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
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
      },
      include: [
        {
          relation: 'experiences',
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

    if (!user) return null;
    if (!user.experiences) return null;

    const experience = user.experiences.find(
      e => e.id === user.onTimeline?.toString(),
    );

    if (!experience) return null;

    return experience;
  }

  async experienceTimeline(userId: string): Promise<Where<Post> | undefined> {
    const experience = await this.getExperience(userId);

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
    const friendIds = await this.friendService.friendRepository.find({
      where: {
        requestorId: userId,
        requesteeId: {inq: userIds},
        status: FriendStatusType.APPROVED,
      },
    });

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
}
