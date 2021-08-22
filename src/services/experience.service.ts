import {Count, repository, Where} from '@loopback/repository';
import {StatusType} from '../enums';
import {Experience, Post} from '../models';
import {ExperienceRepository, UserExperienceRepository, UserRepository} from '../repositories';
import {noneStatusFiltering, setStatus, updatedFiltering} from '../utils/filter-utils';

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

  async filterUpdatedStatus(experienceId: string, experience: Partial<Experience>) {
    const {tags: currentTags, people: currentPeople} = await this.experienceRepository.findById(
      experienceId,
    );

    const newTags = experience.tags ? experience.tags : [];
    const newPeople = experience.people ? experience.people : [];

    const addedTags = updatedFiltering(newTags, currentTags);
    const addedPeople = updatedFiltering(newPeople, currentPeople);

    const deletedTags = updatedFiltering(currentTags, newTags);
    const deletedPeople = updatedFiltering(currentPeople, newPeople);

    const result = {
      addedTags: setStatus(addedTags, StatusType.NEW),
      addedPeople: setStatus(addedPeople, StatusType.NEW),
      deletedTags: setStatus(deletedTags, StatusType.DELETED),
      deletedPeople: setStatus(deletedPeople, StatusType.DELETED),
      isUpdated: false,
    };

    if (
      addedTags.length > 0 ||
      addedPeople.length > 0 ||
      deletedPeople.length > 0 ||
      deletedTags.length > 0
    ) {
      result.isUpdated = true;
    }

    return result;
  }

  async updateOtherExperience(
    experienceId: string,
    experience: Partial<Experience>,
  ): Promise<void> {
    const {addedTags, addedPeople, deletedTags, deletedPeople, isUpdated} =
      await this.filterUpdatedStatus(experienceId, experience);

    if (isUpdated) {
      const {count} = await this.experienceRepository.count({
        clonedFrom: experienceId,
        origin: false,
      });

      for (let i = 0; i < count; i++) {
        const otherUserExperience = await this.experienceRepository.findOne({
          where: {
            clonedFrom: experienceId,
            origin: false,
          },
          limit: 1,
          skip: i,
        });

        if (!otherUserExperience) continue;

        const updatedExperience = {...experience};

        otherUserExperience.tags = updatedFiltering(otherUserExperience.tags, deletedTags);
        otherUserExperience.people = updatedFiltering(otherUserExperience.people, deletedPeople);

        updatedExperience.tags = [...otherUserExperience.tags, ...addedTags, ...deletedTags];
        updatedExperience.people = [
          ...otherUserExperience.people,
          ...addedPeople,
          ...deletedPeople,
        ];

        this.experienceRepository.updateById(
          otherUserExperience.id,
          updatedExperience,
        ) as Promise<void>;
      }

      this.userExperienceRepository.updateAll(
        {status: StatusType.NEW},
        {clonedFrom: experienceId},
      ) as Promise<Count>;
    }
  }
}
