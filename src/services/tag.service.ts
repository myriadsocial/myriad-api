import {repository, Where} from '@loopback/repository';
import {OrderFieldType, OrderType, VisibilityType} from '../enums';
import {Post} from '../models';
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
        await this.tagRepository.create({
          id: tag,
          count: 1,
        });
      } else {
        await this.tagRepository.updateById(foundTag.id, {
          updatedAt: new Date().toString(),
          count: dateUtils.isToday(foundTag.updatedAt) ? 1 : foundTag.count + 1,
        });
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

  async trendingTimeline(): Promise<Where<Post> | undefined> {
    const trendingTopics = await this.trendingTopics();

    if (!trendingTopics.length) return;

    const joinTopics = trendingTopics.join('|');
    const regexTopic = new RegExp(joinTopics, 'i');

    return {
      and: [
        {
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
        },
        {
          visibility: VisibilityType.PUBLIC,
        },
      ],
    } as Where<Post>;
  }
}
