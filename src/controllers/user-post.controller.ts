import {
  Count,
  CountSchema,
  Filter,
  PredicateComparison,
  repository,
  Where,
} from '@loopback/repository';
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
import {
  User,
  Post,
  PublicMetric,
} from '../models';
import {
  UserRepository, 
  AssetRepository, 
  PostRepository, 
  PublicMetricRepository,
  FriendRepository
} from '../repositories';

export class UserPostController {
  constructor(
    @repository(UserRepository) protected userRepository: UserRepository,
    @repository(AssetRepository) protected assetRepository: AssetRepository,
    @repository(PostRepository) protected postRepository: PostRepository,
    @repository(PublicMetricRepository) protected publicMetricRepository: PublicMetricRepository,
    @repository(FriendRepository) protected friendRepository: FriendRepository
  ) { }

  @get('users/{id}/timeline-metric', {
    responses: {
      '200': {
        description: 'User timeline based metrics'
      }
    }
  })
  async findTimelineMetric(
    @param.path.string('id') id:string,
    @param.query.string('orderField') orderField: string,
    @param.query.string('order') order:string,
    @param.query.string('limit') limit:number,
    @param.query.string('offset') offset:number
  ):Promise<Post[]> {
    if (!orderField) orderField = 'comment'
    if (!order) order = 'DESC'
    if (!limit) limit = 10
    if (!offset) offset = 0

    const foundPost = await this.postRepository.find({
      where: {
        or: [
          {
            importBy: {
              inq: [[id]]
            }
          },
          {
            walletAddress: {
              inq: [id]
            }
          }
        ]
      },
      limit: limit,
      offset: offset
    }) 

    if (foundPost.length === 0) {
      const foundPost = await this.defaultPost(orderField, order, limit, offset)
      const postIds = foundPost.map(post => post.id)
      const publicMetrics = await this.filterPublicMetric(orderField, order, limit, offset, postIds)

      return publicMetrics.map((metric:any) => {
        metric.post.publicMetric = {
          id: metric.id,
          liked: metric.liked,
          disliked: metric.disliked,
          comment: metric.comment,
          postId: metric.postId
        }
        return metric.post
      })
    }

    const postIds = foundPost.map(post => post.id)
    const filterMetric = await this.filterPublicMetric(orderField, order, limit, offset, postIds)

    return filterMetric.map((metric:any) => {
      metric.post.publicMetric = {
        id: metric.id,
        liked: metric.liked,
        disliked: metric.disliked,
        comment: metric.comment,
        postId: metric.postId
      }
      return metric.post
    })
  } 
  
  @get('/users/{id}/timeline', {
    responses: {
      '200': {
        description: 'User timeline'
      }
    }
  })
  async findTimeline(
    @param.path.string('id') id: string,
    @param.query.string('orderField') orderField: string,
    @param.query.string('order') order:string,
    @param.query.string('limit') limit:number,
    @param.query.string('offset') offset:number
  ): Promise<Post[]> {
    if (!orderField) orderField = 'platformCreatedAt'
    if (!order) order = 'DESC'
    if (!limit) limit = 10
    if (!offset) offset = 0

    // const acceptedFriends = await this.friendRepository.find({
    //   where: {
    //     status: 'accepted',
    //     requestorId: id
    //   }
    // })

    // const friendIds = [
    //   ...acceptedFriends.map(friend => friend.friendId),
    //   id
    // ]

    const foundPost = await this.postRepository.find({
      where: {
        or: [
          {
            importBy: {
              inq: [[id]]
            }
          },
          {
            walletAddress: {
              inq: [id]
            }
          }
        ]
      },
      order: [`${orderField} ${order.toUpperCase()}`],
      limit: limit,
      offset: offset,
      include: [
        {
          relation: 'comments',
          scope: {
            include: [
              {
                relation: 'user'
              }
            ]
          }
        },
        {
          relation: 'publicMetric'
        }
      ]
    })

    if (foundPost.length === 0) {
      return this.defaultPost(orderField, order, limit, offset)
    }
    
    return foundPost
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
          schema: getModelSchemaRef(Post, {
            title: 'NewPostInUser',
            exclude: ['id'],
            optional: ['walletAddress']
          }),
        },
      },
    }) post: Omit<Post, 'id'>,
  ): Promise<Post> {
    const tags = post.text?.replace(/\s\s+/g, ' ')
      .trim().split(' ').filter(tag => tag.startsWith('#'))
      .map(tag => tag.substr(1))
  
    let assets:string[] = []

    if (post.assets && post.assets.length > 0) {
      assets = post.assets
      post.hasMedia = true
    }

    delete post.assets

    const newPost = await this.userRepository.posts(id).create({
      ...post,
      tags,
      importBy: [id],
      platformCreatedAt: new Date().toString(),
      createdAt: new Date().toString(),
      updatedAt: new Date().toString()
    });

    await this.postRepository.publicMetric(newPost.id).create({})

    if (assets.length > 0) {
      await this.postRepository.asset(newPost.id).create({
        media_urls: assets
      })
    }

    return newPost
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

  async defaultPost (
    orderField: string, 
    order: string, 
    limit:number, 
    offset:number
  ):Promise<Post[]> {
    return this.postRepository.find({
      order: [`${orderField} ${order.toUpperCase()}`],
      limit: limit,
      offset: offset,
      include: [
        {
          relation: 'comments',
          scope: {
            include: [
              {
                relation: 'user'
              }
            ]
          }
        },
        {
          relation: 'publicMetric'
        }
      ],
      where: {
        or: [
          {
            tags: {
              inq: ["cryptocurrency", "blockchain", "technology"]
            }
          },
          {
            'platformUser.username': [
              "elonmusk", 
              "gavofyork", 
              "W3F_Bill", 
              "CryptoChief", 
              "BillGates", 
              "vitalikbuterineth"
            ]
          },
          {
            platform: {
              inq: ["twitter","facebook", "reddit"]
            }
          }
        ]
      }
    } as Filter<Post>)
  }

  async filterPublicMetric(
    orderField: string, 
    order: string, 
    limit: number, 
    offset: number,
    postIds: any[]
  ):Promise<PublicMetric[]> {
    return this.publicMetricRepository.find({
      order: [`${orderField} ${order.toUpperCase()}`],
      limit: limit,
      offset: offset,
      include: [
        {
          relation: "post",
          scope: {
            include: [
              {
                relation: 'comments',
                scope: {
                  include: [
                    {
                      relation: 'user'
                    }
                  ]
                }
              }
            ]
          }
        }
      ],
      where: {
        postId: {
          inq: postIds
        }
      } 
    } as Filter<PublicMetric>)
  }
}
