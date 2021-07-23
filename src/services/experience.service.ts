import { repository } from "@loopback/repository";
import { Experience } from "../models";
import { ExperienceRepository, SavedExperienceRepository } from "../repositories";

export class ExperienceService {
  constructor (
    @repository(SavedExperienceRepository)
    protected savedExperienceRepository: SavedExperienceRepository,
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
  ) {}

  async getExperience(userId: string): Promise<Experience | null> {
    const experience = await this.savedExperienceRepository.findOne({
      where: {userId, hasSelected: true }
    })

    if (!experience) return null;

    return this.experienceRepository.findById(experience.experienceId);
  }
}
