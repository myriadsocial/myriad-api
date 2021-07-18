import {FilterExcludingWhere, repository} from '@loopback/repository';
import {get, getModelSchemaRef, param} from '@loopback/rest';
import {Post} from '../models';
import {
  PostRepository,
  PublicMetricRepository,
  UserRepository,
} from '../repositories';
import {service} from '@loopback/core';
import {FriendService, TagService} from '../services';
import {DefaultInq} from '../enums';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class UserPostController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(PublicMetricRepository)
    protected publicMetricRepository: PublicMetricRepository,
    @service(FriendService)
    protected friendService: FriendService,
    @service(TagService)
    protected tagService: TagService,
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
    @param.query.string('topic') topic: string,
    @param.filter(Post, {exclude: 'where'}) filter?: FilterExcludingWhere<Post>,
  ): Promise<Post[]> {
    let where = null;
    // TODO: move logic to service
    if (!topic) {
      const getApprovedFriendIds = await this.friendService.getApprovedFriendIds(id);
      const friendIds = [...getApprovedFriendIds, id];
      const importBys = friendIds.map(friendId => {
        return {
          importBy: {
            inq: [[friendId]],
          },
        };
      });

      // TODO: move to single constant enum
      where = {
        or: [
          ...importBys,
          {
            walletAddress: {inq: friendIds},
          },
          {
            tags: {inq: DefaultInq.TAGS.split(',')},
          },
          {
            'platformUser.username': {inq: DefaultInq.PEOPLE.split(',')},
          },
        ],
      };
    } else {
      where = {
        tags: {
          inq: [[topic]],
        },
      };
    }

    return this.postRepository.find({
      ...filter,
      where,
    } as FilterExcludingWhere<Post>);
  }
}

// TODO: Removed unused endpoint
