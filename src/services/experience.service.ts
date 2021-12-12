import {repository, Where} from '@loopback/repository';
import {FriendStatusType, PlatformType, VisibilityType} from '../enums';
import {Experience, People, Post} from '../models';
import {
  ExperienceRepository,
  FriendRepository,
  UserExperienceRepository,
  UserRepository,
} from '../repositories';
import {injectable, BindingScope} from '@loopback/core';

@injectable({scope: BindingScope.TRANSIENT})
export class ExperienceService {
  constructor(
    @repository(UserExperienceRepository)
    protected userExperienceRepository: UserExperienceRepository,
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
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
    const friendIds = (
      await this.friendRepository.find({
        where: {
          requesteeId: {inq: userIds},
          requestorId: userId,
          status: FriendStatusType.APPROVED,
        },
      })
    ).map(e => e.requesteeId);

    const joinTags = tags.join('|');
    const regexTag = new RegExp(joinTags, 'i');

    return {
      or: [
        {
          and: [{tags: {inq: tags}}, {visibility: VisibilityType.PUBLIC}],
        },
        {
          and: [
            {peopleId: {inq: personIds}},
            {visibility: VisibilityType.PUBLIC},
          ],
        },
        {
          and: [{text: regexTag}, {visibility: VisibilityType.PUBLIC}],
        },
        {
          and: [{title: regexTag}, {visibility: VisibilityType.PUBLIC}],
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
      ],
    } as Where<Post>;
  }
}
