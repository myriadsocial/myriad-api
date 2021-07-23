import {repository} from '@loopback/repository';
import {OrderFieldType, OrderType} from '../enums';
import { DateUtils } from '../helpers/date-utils';
import {Tag} from '../models';
import {TagRepository} from '../repositories';

export class TagService {
  constructor(
    @repository(TagRepository)
    protected tagRepository: TagRepository,
  ) {}

  async createTags(tags: string[]): Promise<void> {
    const {today, day} = new DateUtils();
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
        const oneDay = day;
        const isToday = today(foundTag.updatedAt) > oneDay;

        this.tagRepository.updateById(foundTag.id, {
          updatedAt: new Date().toString(),
          count: isToday ? 1 : foundTag.count + 1,
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
