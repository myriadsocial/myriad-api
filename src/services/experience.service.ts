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

  async getSelectedExperience(userId: string): Promise<Experience | null> {
    const selectedUserSavedExperience = await this.savedExperienceRepository.findOne({
      where: {userId, hasSelected: true }
    })

    if (!selectedUserSavedExperience) return null;

    return this.experienceRepository.findById(selectedUserSavedExperience.experienceId);
  }
}
