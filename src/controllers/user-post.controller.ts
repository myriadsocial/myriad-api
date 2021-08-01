import {service} from '@loopback/core';
import {FilterExcludingWhere, repository} from '@loopback/repository';
import {get, getModelSchemaRef, param} from '@loopback/rest';
import {TimelineType} from '../enums';
import {noneStatusFiltering} from '../helpers/filter-utils';
import {Post} from '../models';
import {PostRepository} from '../repositories';
import {ExperienceService, FriendService, PostService, TagService} from '../services';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class UserPostController {
  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @service(ExperienceService)
    protected experienceService: ExperienceService,
    @service(TagService)
    protected tagService: TagService,
    @service(FriendService)
    protected friendService: FriendService,
    @service(PostService)
    protected postService: PostService,
  ) {}

  @get('/users/{id}/timeline', {
    responses: {
      '200': {
        description: 'User timeline',
        content: {
          'application/json': {
            schema: 'array',
            items: getModelSchemaRef(Post, {includeRelations: true}),
          },
        },
      },
    },
  })
  async userTimeline(
    @param.path.string('id') id: string,
    @param.query.string('sortBy') sortBy: string,
    @param.filter(Post, {exclude: 'where'}) filter?: FilterExcludingWhere<Post>,
  ): Promise<Post[]> {
    let where = null;

    switch (sortBy) {
      case TimelineType.EXPERIENCE:
        where = await this.experienceService.filterByExperience(id);
        break;

      case TimelineType.TRENDING:
        where = await this.tagService.filterByTrending();
        break;

      case TimelineType.FRIEND:
        where = await this.friendService.filterByFriends(id);
        break;

      case TimelineType.ALL: {
        const approvedFriendIds = await this.friendService.getApprovedFriendIds(id);
        const trendingTopics = await this.tagService.trendingTopics();

        const experience = await this.experienceService.getExperience(id);
        const experienceTopics = experience ? noneStatusFiltering(experience.tags) : [];
        const experiencePersonIds = experience ? noneStatusFiltering(experience.people) : [];

        const friends = [...approvedFriendIds, id];
        const topics = [...trendingTopics, ...experienceTopics];
        const personIds = experiencePersonIds;

        const joinTopics = topics.join('|');
        const regexTopic = new RegExp(joinTopics, 'i');

        if (!friends.length && !topics.length && !personIds.length) {
          where = null;
          break;
        }

        where = {
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

        break;
      }

      default:
        return [];
    }

    if (where === null) return [];

    return this.postRepository.find({
      ...filter,
      where,
    } as FilterExcludingWhere<Post>);
  }
}
