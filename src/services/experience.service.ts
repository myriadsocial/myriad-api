import {repository} from '@loopback/repository';
import {Experience} from '../models';
import {ExperienceRepository, UserExperienceRepository} from '../repositories';

export class ExperienceService {
  constructor(
    @repository(UserExperienceRepository)
    protected userExperienceRepository: UserExperienceRepository,
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
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
}
