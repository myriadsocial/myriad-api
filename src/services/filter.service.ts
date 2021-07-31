import {service} from '@loopback/core';
import {Where} from '@loopback/repository';
import {noneStatusFiltering} from '../helpers/filter-utils';
import {ExperienceService} from './experience.service';
import {FriendService} from './friend.service';
import {TagService} from './tag.service';

export class FilterService {
  constructor(
    @service(ExperienceService)
    protected experienceService: ExperienceService,
    @service(TagService)
    protected tagService: TagService,
    @service(FriendService)
    protected friendService: FriendService,
  ) {}

  async filterByExperience(userId: string): Promise<Where | null> {
    const experience = await this.experienceService.getExperience(userId);

    if (!experience) return null;

    const tags = noneStatusFiltering(experience.tags);
    const personIds = noneStatusFiltering(experience.tags);

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

  async filterByTrending(): Promise<Where | null> {
    const trendingTopics = await this.tagService.trendingTopics();

    if (!trendingTopics.length) return null;

    const joinTopics = trendingTopics.join('|');
    const regexTopic = new RegExp(joinTopics, 'i');

    return {
      or: [
        {
          tags: {
            inq: trendingTopics,
          },
        },
        {
          text: regexTopic,
        },
        {
          title: regexTopic,
        },
      ],
    };
  }

  async filterByFriends(userId: string): Promise<Where | null> {
    const approvedFriendIds = await this.friendService.getApprovedFriendIds(userId);

    if (!approvedFriendIds.length) return null;

    return {
      or: [
        {
          importBy: {
            inq: approvedFriendIds,
          },
        },
        {
          walletAddress: {
            inq: approvedFriendIds,
          },
        },
      ],
    };
  }

  async showAll(userId: string): Promise<Where | null> {
    const approvedFriendIds = await this.friendService.getApprovedFriendIds(userId);
    const trendingTopics = await this.tagService.trendingTopics();

    const experience = await this.experienceService.getExperience(userId);
    const experienceTopics: string[] = experience ? noneStatusFiltering(experience.tags) : [];
    const experiencePersonIds: string[] = experience
      ? noneStatusFiltering(experience.people)
      : [];

    const friends = [...approvedFriendIds, userId];
    const topics = [...trendingTopics, ...experienceTopics];
    const personIds = experiencePersonIds;

    const joinTopics = topics.join('|');
    const regexTopic = new RegExp(joinTopics, 'i');

    if (!friends.length && !topics.length && !personIds.length) return null;

    return {
      or: [
        {
          tags: {
            inq: topics,
          },
        },
        {
          title: regexTopic,
        },
        {
          text: regexTopic,
        },
        {
          peopleId: {
            inq: personIds,
          },
        },
        {
          importBy: {
            inq: friends,
          },
        },
        {
          walletAddress: {
            inq: friends,
          },
        },
      ],
    };
  }
}
