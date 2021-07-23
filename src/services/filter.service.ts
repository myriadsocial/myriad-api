import { service } from "@loopback/core";
import { Where } from "@loopback/repository";
import { ExperienceService } from "./experience.service";
import { FriendService } from "./friend.service";
import { TagService } from "./tag.service";

export class FilterService {
  constructor(
    @service(ExperienceService)
    protected experienceService: ExperienceService,
    @service(TagService)
    protected tagService: TagService,
    @service(FriendService)
    protected friendService: FriendService
  ) {}

  async filterByExperience(userId: string): Promise<Where | null> {
    const experience = await this.experienceService.getExperience(userId);

    if (!experience) return null;

    const tags = experience.tags;
    const personIds = experience.people.map(person => person.id);

    return {
      or: [
        {
          tags: {
            inq: tags
          },
        },
        {
          peopleId: {
            inq: personIds
          }
        }
      ]
    }
  }

  async filterByTrending(): Promise<Where | null> {
    const trendingTopics = await this.tagService.trendingTopics();

    if (!trendingTopics.length) return null

    return {
      tags: {
        inq: trendingTopics
      }
    }
  }

  async filterByFriends(userId: string): Promise<Where | null> {
    const approvedFriendIds = await this.friendService.getApprovedFriendIds(userId);

    if (!approvedFriendIds.length) return null;

    return {
      or: [
        {
          importBy: {
            inq: approvedFriendIds
          }
        },
        {
          walletAddress: {
            inq: approvedFriendIds
          }
        }
      ]
    }
  }

  async showAll(userId: string): Promise<Where | null> {
    const approvedFriendIds = await this.friendService.getApprovedFriendIds(userId);
    const trendingTopics = await this.tagService.trendingTopics();

    const experience = await this.experienceService.getExperience(userId);
    const experienceTopics: string[] = experience ? experience.tags : [];
    const experiencePersonIds: string[] = experience ? experience.people.map(person => person.id) : [];

    const friends = [...approvedFriendIds, userId];
    const topics = [...trendingTopics, ...experienceTopics];
    const personIds = experiencePersonIds;

    if (!friends.length && !topics.length && !personIds.length) return null;

    return {
      or: [
        {
          tags: {
            inq: topics
          },
        },
        {
          peopleId: {
            inq: personIds
          }
        },
        {
          importBy: {
            inq: friends
          }
        },
        {
          walletAddress: {
            inq: friends
          }
        }
      ]
    }
  }
}
