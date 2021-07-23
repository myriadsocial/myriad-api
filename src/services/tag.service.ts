import {repository} from '@loopback/repository';
import {OrderFieldType, OrderType} from '../enums';
import {Tag} from '../models';
import {TagRepository} from '../repositories';

export class TagService {
  constructor(
    @repository(TagRepository)
    protected tagRepository: TagRepository,
  ) {}

  async createTags(tags: string[]): Promise<void> {
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
        const oneDay: number = 60 * 60 * 24 * 1000;
        const isOneDay: boolean =
          new Date().getTime() - new Date(foundTag.updatedAt).getTime() > oneDay;

        this.tagRepository.updateById(foundTag.id, {
          updatedAt: new Date().toString(),
          count: isOneDay ? 1 : foundTag.count + 1,
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
}
