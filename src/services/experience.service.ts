import {repository, Where} from '@loopback/repository';
import {Experience, Post} from '../models';
import {ExperienceRepository, UserExperienceRepository, UserRepository} from '../repositories';
import {noneStatusFiltering} from '../utils/filter-utils';

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

  async filterByExperience(userId: string): Promise<Where<Post> | null> {
    const experience = await this.getExperience(userId);

    if (!experience) return null;

    const tags = noneStatusFiltering(experience.tags);
    const personIds = noneStatusFiltering(experience.people);

    const joinTags = tags.join('|');
    const regexTag = new RegExp(joinTags, 'i');

    return {
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
    } as Where<Post>;
  }
}
