import {BindingScope, injectable, service} from '@loopback/core';
import {Filter, repository, Where} from '@loopback/repository';
import {pull} from 'lodash';
import {
  FriendStatusType,
  OrderFieldType,
  OrderType,
  VisibilityType,
} from '../enums';
import {Post, Tag} from '../models';
import {PostRepository, TagRepository} from '../repositories';
import {FriendService} from './friend.service';

@injectable({scope: BindingScope.TRANSIENT})
export class TagService {
  constructor(
    @repository(TagRepository)
    private tagRepository: TagRepository,
    @repository(PostRepository)
    private postRepository: PostRepository,
    @service(FriendService)
    private friendService: FriendService,
  ) {}

  public async find(filter?: Filter<Tag>): Promise<Tag[]> {
    return this.tagRepository.find(filter);
  }

  public async create(tags: string[], experience?: boolean): Promise<void> {
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

  public async timeline(userId: string): Promise<Where<Post>> {
    const trendingTopics = await this.tagRepository.find({
      order: [
        `${OrderFieldType.COUNT} ${OrderType.DESC}`,
        `${OrderFieldType.UPDATEDAT} ${OrderType.DESC}`,
      ],
      limit: 5,
    });

    const trendingTopicIds = trendingTopics.map(tag => tag.id);

    if (!trendingTopicIds.length) return {id: ''};

    const [approvedFriendIds, blockedFriendIds] = await Promise.all([
      this.friendService.getFriendIds(userId, FriendStatusType.APPROVED),
      this.friendService.getFriendIds(userId, FriendStatusType.BLOCKED),
    ]);

    const blocked = pull(blockedFriendIds, ...approvedFriendIds);

    return {
      or: [
        {
          and: [
            {tags: {inq: trendingTopicIds}},
            {createdBy: {nin: blocked}},
            {visibility: VisibilityType.PUBLIC},
          ],
        },
        {
          and: [
            {tags: {inq: trendingTopicIds}},
            {createdBy: {inq: approvedFriendIds}},
            {visibility: VisibilityType.FRIEND},
          ],
        },
        {
          and: [{tags: {inq: trendingTopicIds}}, {createdBy: userId}],
        },
      ],
    } as Where<Post>;
  }
}
