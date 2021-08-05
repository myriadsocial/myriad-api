import {service} from '@loopback/core';
import {Filter, repository} from '@loopback/repository';
import {get, getModelSchemaRef, param} from '@loopback/rest';
import {TimelineType} from '../enums';
import {defaultFilterQuery, noneStatusFiltering} from '../helpers/filter-utils';
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
    @param.query.number('page') page: number,
    @param.filter(Post, {exclude: ['where', 'skip', 'offset']}) filter?: Filter<Post>,
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

      case TimelineType.ALL:
      default: {
        const approvedFriendIds = await this.friendService.getApprovedFriendIds(id);
        const trendingTopics = await this.tagService.trendingTopics();

        const experience = await this.experienceService.getExperience(id);
        const experienceTopics = experience ? noneStatusFiltering(experience.tags) : [];
        const experiencePersonIds = experience ? noneStatusFiltering(experience.people) : [];

        const friends = [...approvedFriendIds, id];
        const topics = [...trendingTopics, ...experienceTopics];
        const personIds = experiencePersonIds;

        if (!friends.length && !topics.length && !personIds.length) break;

        const joinTopics = topics.join('|');
        const regexTopic = new RegExp(joinTopics, 'i');

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
      }
    }

    if (where === null) return [];

    const newFilter = defaultFilterQuery(page, filter, where) as Filter<Post>;

    return this.postRepository.find(newFilter);
  }
}
