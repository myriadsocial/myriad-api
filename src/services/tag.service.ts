import {repository, Where} from '@loopback/repository';
import {OrderFieldType, OrderType} from '../enums';
import {Post, Tag} from '../models';
import {TagRepository} from '../repositories';
import {DateUtils} from '../utils/date-utils';

export class TagService {
  constructor(
    @repository(TagRepository)
    protected tagRepository: TagRepository,
  ) {}

  async createTags(tags: string[]): Promise<void> {
    const dateUtils = new DateUtils();
    for (const tag of tags) {
      const foundTag = await this.tagRepository.findOne({
        where: {
          or: [
            {
              id: tag,
            },
            {
              id: tag.toLowerCase(),
            },
            {
              id: tag.toUpperCase(),
            },
          ],
        },
      });

      if (!foundTag) {
        this.tagRepository.create({
          id: tag,
          count: 1,
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
        }) as Promise<Tag>;
      } else {
        this.tagRepository.updateById(foundTag.id, {
          updatedAt: new Date().toString(),
          count: dateUtils.isToday(foundTag.updatedAt) ? 1 : foundTag.count + 1,
        }) as Promise<void>;
      }
    }
  }

  async trendingTopics(): Promise<string[]> {
    const trendingTopic = await this.tagRepository.find({
      order: [
        `${OrderFieldType.COUNT} ${OrderType.DESC}`,
        `${OrderFieldType.UPDATEDAT} ${OrderType.DESC}`,
      ],
      limit: 5,
    });

    return trendingTopic.map(tag => tag.id);
  }

  async filterByTrending(): Promise<Where<Post> | null> {
    const trendingTopics = await this.trendingTopics();

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
    } as Where<Post>;
  }
}
