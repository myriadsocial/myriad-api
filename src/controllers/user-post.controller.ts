import {Count, CountSchema, Filter, repository, Where} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  HttpErrors,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import {Post, User} from '../models';
import {
  FriendRepository,
  PostRepository,
  PublicMetricRepository,
  TagRepository,
  UserRepository,
} from '../repositories';
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
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
    @repository(TagRepository)
    protected tagRepository: TagRepository,
  ) {}

  @get('/users/{id}/timeline', {
    responses: {
      '200': {
        description: 'User timeline',
      },
    },
  })
  async findTimeline(
    @param.path.string('id') id: string,
    @param.query.string('orderField') orderField: string,
    @param.query.string('order') order: string,
    @param.query.string('limit') limit: number,
    @param.query.string('offset') offset: number,
  ): Promise<Post[]> {
    if (!orderField) orderField = 'platformCreatedAt';
    if (!order) order = 'DESC';
    if (!limit) limit = 10;
    if (!offset) offset = 0;

    if (orderField === 'comment') orderField = 'totalComment';
    if (orderField === 'liked') orderField = 'totalLiked';
    if (orderField === 'disliked') orderField = 'totalDisliked';

    const orderFields = ['platformCreatedAt', 'totalComment', 'totalDisliked', 'totalLiked'];
    const orders = ['DESC', 'ASC'];
    const foundField = orderFields.find(field => field === orderField);
    const foundOrder = orders.find(ord => ord === order.toUpperCase());

    if (!foundField)
      throw new HttpErrors.UnprocessableEntity(
        'The following fields are mandatory: platformCreatedAt, comment, liked, or disliked',
      );
    if (!foundOrder)
      throw new HttpErrors.UnprocessableEntity(
        'Please choose one of the following order values: ASC or DESC',
      );

    const acceptedFriends = await this.friendRepository.find({
      where: {
        status: 'approved',
        or: [
          {
            friendId: id,
          },
          {
            requestorId: id,
          },
        ],
      },
    });

    const friendIds = [
      ...acceptedFriends.map(friend => friend.friendId),
      ...acceptedFriends.map(friend => friend.requestorId),
      id,
    ];

    const importBys = friendIds.map(id => {
      return {
        importBy: {
          inq: [[id]],
        },
      };
    });

    return this.postRepository.find({
      where: {
        or: [
          ...importBys,
          {
            walletAddress: {
              inq: friendIds,
            },
          },
          {
            tags: {
              inq: ['cryptocurrency', 'blockchain', 'technology'],
            },
          },
          {
            'platformUser.username': {
              inq: [
                'elonmusk',
                'gavofyork',
                'W3F_Bill',
                'CryptoChief',
                'BillGates',
                'vitalikbuterineth',
              ],
            },
          },
        ],
      },
      order: [`${orderField} ${order.toUpperCase()}`, `platformCreatedAt ${order.toUpperCase()}`],
      limit: limit,
      offset: offset,
      include: [
        {
          relation: 'comments',
          scope: {
            include: [
              {
                relation: 'user',
              },
            ],
          },
        },
        {
          relation: 'publicMetric',
        },
      ],
    } as Filter<Post>);
  }

  @get('/users/{id}/posts', {
    responses: {
      '200': {
        description: 'Array of User has many Post',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Post)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Post>,
  ): Promise<Post[]> {
    return this.userRepository.posts(id).find(filter);
  }

  @post('/users/{id}/posts', {
    responses: {
      '200': {
        description: 'User model instance',
        content: {'application/json': {schema: getModelSchemaRef(Post)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof User.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['text'],
            properties: {
              text: {
                type: 'string',
              },
              tags: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              asset: {
                type: 'object',
                properties: {
                  images: {
                    type: 'array',
                    items: {
                      type: 'string',
                    },
                  },
                  videos: {
                    type: 'array',
                    items: {
                      type: 'string',
                    },
                  },
                },
              },
            },
          },
        },
      },
    })
    post: Omit<Post, 'id'>,
  ): Promise<Post> {
    if (post.asset) {
      if (post.asset.images.length > 0 || post.asset.videos.length > 0) {
        post.hasMedia = true;
      }
    }

    delete post.platformUser;

    const newPost = await this.userRepository.posts(id).create({
      ...post,
      walletAddress: id,
      platform: 'myriad',
      platformCreatedAt: new Date().toString(),
      createdAt: new Date().toString(),
      updatedAt: new Date().toString(),
    });

    this.postRepository.publicMetric(newPost.id).create({});

    const tags = post.tags;

    for (let i = 0; i < tags.length; i++) {
      const foundTag = await this.tagRepository.findOne({
        where: {
          or: [
            {
              id: tags[i],
            },
            {
              id: tags[i].toLowerCase(),
            },
            {
              id: tags[i].toUpperCase(),
            },
          ],
        },
      });

      if (!foundTag) {
        this.tagRepository.create({
          id: tags[i],
          count: 1,
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
        });
      } else {
        const oneDay: number = 60 * 60 * 24 * 1000;
        const isOneDay: boolean =
          new Date().getTime() - new Date(foundTag.updatedAt).getTime() > oneDay;

        this.tagRepository.updateById(foundTag.id, {
          updatedAt: new Date().toString(),
          count: isOneDay ? 1 : foundTag.count + 1,
        });
      }
    }

    return newPost;
  }

  @patch('/users/{id}/posts', {
    responses: {
      '200': {
        description: 'User.Post PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Post, {partial: true}),
        },
      },
    })
    post: Partial<Post>,
    @param.query.object('where', getWhereSchemaFor(Post)) where?: Where<Post>,
  ): Promise<Count> {
    return this.userRepository.posts(id).patch(post, where);
  }

  @del('/users/{id}/posts', {
    responses: {
      '200': {
        description: 'User.Post DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Post)) where?: Where<Post>,
  ): Promise<Count> {
    return this.userRepository.posts(id).delete(where);
  }
}
