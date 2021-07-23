import {FilterExcludingWhere, repository} from '@loopback/repository';
import {get, getModelSchemaRef, param} from '@loopback/rest';
import {Post} from '../models';
import {PostRepository, PublicMetricRepository} from '../repositories';
import {service} from '@loopback/core';
import {FilterService, FriendService, TagService} from '../services';
import {TimelineType} from '../enums';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class UserPostController {
  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(PublicMetricRepository)
    protected publicMetricRepository: PublicMetricRepository,
    @service(FriendService)
    protected friendService: FriendService,
    @service(TagService)
    protected tagService: TagService,
    @service(FilterService)
    protected filterService: FilterService,
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

    // TODO: improve timeline filter logic
    switch (sortBy) {
      case TimelineType.EXPERIENCE:
        where = await this.filterService.filterByExperience(id);
        break;

      case TimelineType.TRENDING:
        where = await this.filterService.filterByTrending();
        break;

      case TimelineType.FRIEND:
        where = await this.filterService.filterByFriends(id);
        break;

      case TimelineType.ALL:
        where = await this.filterService.showAll(id);
        break;

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
