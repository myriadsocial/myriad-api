import {repository, Where} from '@loopback/repository';
import {noneStatusFiltering} from '../helpers/filter-utils';
import {Experience} from '../models';
import {ExperienceRepository, UserExperienceRepository} from '../repositories';

export class ExperienceService {
  constructor(
    @repository(UserExperienceRepository)
    public userExperienceRepository: UserExperienceRepository,
    @repository(ExperienceRepository)
    public experienceRepository: ExperienceRepository,
  ) {}

  async getExperience(userId: string): Promise<Experience | null> {
    const userExperience = await this.userExperienceRepository.findOne({
      where: {userId, hasSelected: true},
    });

    if (!userExperience) return null;

    return this.experienceRepository.findOne({
      where: {
        id: userExperience.experienceId,
      },
    });
  }

  async filterByExperience(userId: string): Promise<Where | null> {
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
    };
  }
}
