import {repository, Where} from '@loopback/repository';
import {VisibilityType} from '../enums';
import {Experience, Post} from '../models';
import {ExperienceRepository, UserExperienceRepository, UserRepository} from '../repositories';

export class ExperienceService {
  constructor(
    @repository(UserExperienceRepository)
    protected userExperienceRepository: UserExperienceRepository,
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
  ) {}

  async getExperience(userId: string): Promise<Experience | null> {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
      },
      include: ['experiences'],
    });

    if (!user) return null;
    if (!user.experiences) return null;

    const experience = user.experiences.find(e => e.id === user.onTimeline?.toString());

    if (!experience) return null;

    return experience;
  }

  async experienceTimeline(userId: string): Promise<Where<Post> | undefined> {
    const experience = await this.getExperience(userId);

    if (!experience) return;

    const tags = experience.tags;
    const personIds = experience.people.map(e => e.id);

    const joinTags = tags.join('|');
    const regexTag = new RegExp(joinTags, 'i');

    return {
      and: [
        {
          or: [
            {
              tags: {
                inq: tags,
              },
            },
            {
              peopleId: {
                inq: personIds,
              },
            },
            {
              text: regexTag,
            },
            {
              title: regexTag,
            },
          ],
        },
        {visibility: VisibilityType.PUBLIC},
      ],
    } as Where<Post>;
  }
}
