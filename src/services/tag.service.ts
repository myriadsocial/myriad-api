import {repository, Where} from '@loopback/repository';
import {
  FriendStatusType,
  OrderFieldType,
  OrderType,
  VisibilityType,
} from '../enums';
import {Post} from '../models';
import {PostRepository, TagRepository} from '../repositories';
import {injectable, BindingScope, service} from '@loopback/core';
import {FriendService} from './friend.service';

@injectable({scope: BindingScope.TRANSIENT})
export class TagService {
  constructor(
    @repository(TagRepository)
    public tagRepository: TagRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @service(FriendService)
    protected friendService: FriendService,
  ) {}

  async createTags(tags: string[], experience?: boolean): Promise<void> {
    for (const tag of tags) {
      try {
        await this.tagRepository.create({
          id: tag,
          count: experience ? 0 : 1,
        });
      } catch {
        if (experience) continue;
        const {count} = await this.postRepository.count({
          tags: {
            inq: [[tag]],
          },
          deletedAt: {exists: false},
        });

        await this.tagRepository.updateById(tag, {
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

    const approvedFriendIds = await this.friendService.getFriendIds(
      userId,
      FriendStatusType.APPROVED,
    );
    const blockedFriendIds = await this.friendService.getFriendIds(
      userId,
      FriendStatusType.BLOCKED,
    );
    const blockedUserIds = blockedFriendIds.filter(
      id => !approvedFriendIds.includes(id),
    );

    return {
      or: [
        {
          and: [
            {tags: {inq: trendingTopics}},
            {createdBy: {nin: blockedUserIds}},
            {visibility: VisibilityType.PUBLIC},
          ],
        },
        {
          and: [
            {tags: {inq: trendingTopics}},
            {createdBy: {inq: approvedFriendIds}},
            {visibility: VisibilityType.FRIEND},
          ],
        },
        {
          and: [{tags: {inq: trendingTopics}}, {createdBy: userId}],
        },
      ],
    } as Where<Post>;
  }
}
