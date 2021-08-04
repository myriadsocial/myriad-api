import {service} from '@loopback/core';
import {Count, CountSchema, Filter, repository, Where} from '@loopback/repository';
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
import {Dislike, Like, Post} from '../models';
import {PostRepository} from '../repositories';
import {MetricService} from '../services';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class PostLikeController {
  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @service(MetricService) public metricService: MetricService,
  ) {}

  @get('/posts/{id}/likes', {
    responses: {
      '200': {
        description: 'Array of Post has many Like',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Like)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Like>,
  ): Promise<Like[]> {
    return this.postRepository.likes(id).find(filter);
  }

  @post('/posts/{id}/likes', {
    responses: {
      '200': {
        description: 'Post model instance',
        content: {'application/json': {schema: getModelSchemaRef(Like)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Post.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              userId: {
                type: 'string',
              },
            },
          },
        },
      },
    })
    like: Omit<Like, 'id'>,
  ): Promise<Like | Dislike> {
    return this.metricService.likeDislikeSystem(
      {
        userId: like.userId,
        postId: id,
      },
      true,
    );
  }

  @patch('/posts/{id}/likes', {
    responses: {
      '200': {
        description: 'Post.Like PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Like, {partial: true}),
        },
      },
    })
    like: Partial<Like>,
    @param.query.object('where', getWhereSchemaFor(Like)) where?: Where<Like>,
  ): Promise<Count> {
    return this.postRepository.likes(id).patch(like, where);
  }

  @del('/posts/{id}/likes', {
    responses: {
      '200': {
        description: 'Post.Like DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Like)) where?: Where<Like>,
  ): Promise<Count> {
    return this.postRepository.likes(id).delete(where);
  }
}
