import {repository, Where} from '@loopback/repository';
import {
  FriendStatusType,
  OrderFieldType,
  OrderType,
  VisibilityType,
} from '../enums';
import {Post} from '../models';
import {FriendRepository, PostRepository, TagRepository} from '../repositories';
import {DateUtils} from '../utils/date-utils';
import {injectable, BindingScope} from '@loopback/core';

@injectable({scope: BindingScope.TRANSIENT})
export class TagService {
  constructor(
    @repository(TagRepository)
    protected tagRepository: TagRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
  ) {}

  async createTags(tags: string[]): Promise<void> {
    const dateUtils = new DateUtils();
    for (const tag of [...new Set(tags)]) {
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

      let count = 1;

      if (!foundTag) {
        await this.tagRepository.create({
          id: tag,
          count: count,
        });
      } else {
        const today = new Date();

        if (!dateUtils.isToday(foundTag.updatedAt)) {
          ({count} = await this.postRepository.count({
            tags: {
              inq: [[foundTag.id]],
            },
            createdAt: {
              gt: new Date(
                today.getTime() - new Date(foundTag.updatedAt).getTime(),
              ).toString(),
            },
          }));
        }

        await this.tagRepository.updateById(foundTag.id, {
          updatedAt: new Date().toString(),
          count: count,
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

  async trendingTimeline(userId: string): Promise<Where<Post> | undefined> {
    const trendingTopics = await this.trendingTopics();

    if (!trendingTopics.length) return;

    const friendIds = (
      await this.friendRepository.find({
        where: {
          requestorId: userId,
          status: FriendStatusType.APPROVED,
        },
      })
    ).map(e => e.requesteeId);

    return {
      or: [
        {
          and: [
            {tags: {inq: trendingTopics}},
            {visibility: VisibilityType.PUBLIC},
          ],
        },
        {
          and: [
            {tags: {inq: trendingTopics}},
            {createdBy: {inq: friendIds}},
            {visibility: VisibilityType.FRIEND},
          ],
        },
      ],
    } as Where<Post>;
  }
}
