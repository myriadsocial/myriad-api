import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import {
  User,
  Post,
} from '../models';
import {UserRepository, AssetRepository, PostRepository, PublicMetricRepository} from '../repositories';

export class UserPostController {
  constructor(
    @repository(UserRepository) protected userRepository: UserRepository,
    @repository(AssetRepository) protected assetRepository: AssetRepository,
    @repository(PostRepository) protected postRepository: PostRepository,
    @repository(PublicMetricRepository) protected publicMetricRepository: PublicMetricRepository
  ) { }

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
  
    let assets:string[] = []

    if (post.assets && post.assets.length > 0) {
      assets = post.assets
      post.hasMedia = true
    }

    delete post.assets

    const newPost = await this.userRepository.posts(id).create({
      ...post,
      platformCreatedAt: new Date().toString(),
      tags
    });
    
    await this.publicMetricRepository.create({
      liked: 0,
      comment: 0,
      postId: newPost.id
    })

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
}
